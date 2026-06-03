/**
 * 飞书机器人长连接（WebSocket）客户端
 * 使用 @larksuiteoapi/node-sdk 的 WSClient 建立与飞书开放平台的长连接
 * 替代传统的 HTTP 事件订阅方式，无需公网 IP/域名
 *
 * 优势：
 * - 本地开发无需内网穿透
 * - 无需处理解密和签名验证
 * - 无需公网 IP 或域名
 * - 无需配置防火墙和白名单
 */

import * as Lark from "@larksuiteoapi/node-sdk";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { chatWithBot } from "@/lib/ai-chat";
import { logBotMessage } from "@/lib/bot-notification";

// === 类型定义 ===

export type WsClientStatus = "disconnected" | "connecting" | "connected" | "error";

interface WsClientState {
  status: WsClientStatus;
  appId: string;
  botName: string;
  connectedAt: string | null;
  lastEventAt: string | null;
  error: string | null;
  eventCount: number;
}

// === 全局状态（通过 globalThis 跨模块共享） ===
// Next.js dev 模式下 instrumentation 和 API route 可能加载不同的模块实例，
// 导致模块级变量被隔离。通过 globalThis 确保状态共享。

interface FeishuWsGlobalState {
  wsClients: Map<string, Lark.WSClient>;
  larkClients: Map<string, Lark.Client>;
  clientStates: Map<string, WsClientState>;
}

const GLOBAL_KEY = "__feishu_ws_state__" as const;

function getGlobalState(): FeishuWsGlobalState {
  const g = globalThis as Record<string, unknown>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      wsClients: new Map<string, Lark.WSClient>(),
      larkClients: new Map<string, Lark.Client>(),
      clientStates: new Map<string, WsClientState>(),
    };
  }
  return g[GLOBAL_KEY] as FeishuWsGlobalState;
}

const wsClients = getGlobalState().wsClients;
const larkClients = getGlobalState().larkClients;
const clientStates = getGlobalState().clientStates;

/**
 * 获取所有飞书长连接客户端的状态
 */
export function getFeishuWsStatus(): WsClientState[] {
  return Array.from(clientStates.values());
}

/**
 * 获取指定 app_id 的客户端状态
 */
export function getFeishuWsStatusByAppId(appId: string): WsClientState | undefined {
  return clientStates.get(appId);
}

// === 飞书消息回复 ===

async function replyMessage(
  appId: string,
  chatId: string,
  replyText: string,
  botConfigId?: number
): Promise<boolean> {
  const client = larkClients.get(appId);
  if (!client) {
    console.error("[FeishuWs] 找不到 Lark Client，无法回复消息");
    return false;
  }

  try {
    const res = await client.im.v1.message.create({
      params: {
        receive_id_type: "chat_id",
      },
      data: {
        receive_id: chatId,
        content: JSON.stringify({ text: replyText }),
        msg_type: "text",
      },
    });
    if (res.code === 0) {
      // 记录回复消息留痕
      if (botConfigId) {
        await logBotMessage({
          bot_config_id: botConfigId,
          direction: "outbound",
          platform: "feishu",
          chat_id: chatId,
          message_type: "text",
          content: replyText,
          event_type: "chat",
          status: "success",
        });
      }
      return true;
    }
    console.error("[FeishuWs] 回复消息失败:", res.code, res.msg);
    // 记录回复失败留痕
    if (botConfigId) {
      await logBotMessage({
        bot_config_id: botConfigId,
        direction: "outbound",
        platform: "feishu",
        chat_id: chatId,
        message_type: "text",
        content: replyText,
        event_type: "chat",
        status: "failed",
        error_message: `飞书API错误 ${res.code}: ${res.msg}`,
      });
    }
    return false;
  } catch (error) {
    console.error("[FeishuWs] 回复消息异常:", error);
    // 记录回复异常留痕
    if (botConfigId) {
      await logBotMessage({
        bot_config_id: botConfigId,
        direction: "outbound",
        platform: "feishu",
        chat_id: chatId,
        message_type: "text",
        content: replyText,
        event_type: "chat",
        status: "failed",
        error_message: error instanceof Error ? error.message : "回复消息异常",
      });
    }
    return false;
  }
}

interface BotConfigRow {
  app_id: string;
  app_secret: string;
  id: number;
  name: string;
  [key: string]: unknown;
}

// === AI 回复处理 ===

async function handleAiReply(
  appId: string,
  botConfig: BotConfigRow,
  chatId: string,
  userText: string
): Promise<void> {
  try {
    // 先发送"正在思考"提示
    await replyMessage(appId, chatId, "🤔 思考中...", botConfig.id);

    // 调用AI获取回复
    const aiReply = await chatWithBot(userText, {
      botName: botConfig.name,
    });

    // 截断过长的回复（飞书单条消息限制）
    const maxLen = 4000;
    const replyText = aiReply.length > maxLen
      ? aiReply.slice(0, maxLen) + "\n\n...(回复过长已截断)"
      : aiReply;

    await replyMessage(appId, chatId, replyText, botConfig.id);

    // 更新发送计数
    await db.updateTable("bot_configs")
      .set({
        last_sent_at: sql`NOW()`,
        send_count: sql`send_count + 1`,
      })
      .where("id", "=", botConfig.id)
      .execute()
      .catch(() => {});

    console.log(`[FeishuWs] AI回复成功: chat=${chatId}, len=${replyText.length}`);
  } catch (error: unknown) {
    console.error("[FeishuWs] AI回复处理失败:", error);
    await replyMessage(appId, chatId, "抱歉，AI服务暂时不可用，请稍后再试。", botConfig.id);

    await db.updateTable("bot_configs")
      .set({ fail_count: sql`fail_count + 1` })
      .where("id", "=", botConfig.id)
      .execute()
      .catch(() => {});
  }
}

// === 启动长连接 ===

/**
 * 启动所有已启用的飞书 App 模式机器人的长连接
 * 应在服务启动时调用（instrumentation.ts register）
 */
export async function startFeishuWsClients(): Promise<void> {
  try {
    const botConfigs = await db.selectFrom("bot_configs")
      .where("type", "=", "feishu")
      .where("auth_mode", "=", "app")
      .where("enabled", "=", 1)
      .selectAll()
      .execute() as BotConfigRow[];

    if (botConfigs.length === 0) {
      console.log("[FeishuWs] 没有已启用的飞书 App 模式机器人，跳过长连接启动");
      return;
    }

    for (const config of botConfigs) {
      const { app_id, app_secret, id, name } = config;

      if (!app_id || !app_secret) {
        console.warn(`[FeishuWs] 机器人 "${name}" 缺少 App ID 或 App Secret，跳过`);
        continue;
      }

      // 如果已经有该 app_id 的连接在运行，跳过
      if (wsClients.has(app_id)) {
        const existingWs = wsClients.get(app_id)!;
        const status = existingWs.getConnectionStatus();
        if (status.state === "connected") {
          console.log(`[FeishuWs] 机器人 "${name}" (${app_id}) 已连接，跳过`);
          continue;
        }
        // 非连接状态，关闭旧的重新连接
        existingWs.close({ force: true });
        wsClients.delete(app_id);
      }

      console.log(`[FeishuWs] 启动机器人 "${name}" (${app_id}) 的长连接...`);

      const baseConfig = {
        appId: app_id,
        appSecret: app_secret,
      };

      // 创建 Lark Client 用于 API 调用
      const client = new Lark.Client(baseConfig);
      larkClients.set(app_id, client);

      // 创建 WSClient 用于长连接事件订阅
      const ws = new Lark.WSClient({
        ...baseConfig,
        loggerLevel: Lark.LoggerLevel.info,
      });

      // 初始化状态为 connecting
      clientStates.set(app_id, {
        status: "connecting",
        appId: app_id,
        botName: name,
        connectedAt: null,
        lastEventAt: null,
        error: null,
        eventCount: 0,
      });

      // 注册事件处理器
      const eventDispatcher = new Lark.EventDispatcher({}).register({
        "im.message.receive_v1": async (data) => {
          const state = clientStates.get(app_id);
          if (state) {
            state.lastEventAt = new Date().toISOString();
            state.eventCount++;
          }

          const { message, sender } = data;
          if (!message || !sender) return;

          // 忽略机器人自己发的消息，避免循环
          if (sender.sender_type === "app") return;

          const msgType = message.message_type;
          const chatId = message.chat_id;

          // 只处理文本消息
          if (msgType !== "text") {
            await replyMessage(app_id, chatId, "目前只支持文本消息对话，请发送文字与我交流~", config.id);
            return;
          }

          // 解析文本内容
          let userText = "";
          try {
            const textContent = JSON.parse(message.content);
            userText = textContent.text || "";
          } catch {
            userText = message.content || "";
          }

          // 去掉 @机器人 的提及
          userText = userText.replace(/@_user_\d+/g, "").trim();

          if (!userText) {
            await replyMessage(app_id, chatId, "你好！有什么可以帮你的吗？", config.id);
            return;
          }

          // 记录接收消息留痕
          await logBotMessage({
            bot_config_id: config.id,
            direction: "inbound",
            platform: "feishu",
            chat_id: chatId,
            sender_id: sender.sender_id?.user_id || sender.sender_id?.open_id || null,
            sender_name: null,
            message_type: msgType,
            content: userText,
            event_type: "chat",
            status: "success",
          });

          console.log(
            `[FeishuWs] 收到消息: chat=${chatId}, sender=${sender.sender_id?.user_id}, text=${userText.slice(0, 100)}`
          );

          // 异步处理AI回复
          handleAiReply(app_id, config, chatId, userText).catch((err) => {
            console.error("[FeishuWs] AI回复异常:", err);
          });
        },
      });

      // 启动长连接（await 等待连接完成）
      try {
        await ws.start({
          eventDispatcher,
        });

        wsClients.set(app_id, ws);

        // 更新状态为 connected
        const state = clientStates.get(app_id);
        if (state) {
          state.status = "connected";
          state.connectedAt = new Date().toISOString();
          state.error = null;
        }

        console.log(`[FeishuWs] 机器人 "${name}" (${app_id}) 长连接已建立`);
      } catch (error: unknown) {
        // 连接失败
        const state = clientStates.get(app_id);
        if (state) {
          state.status = "error";
          state.error = error instanceof Error ? error.message : "连接失败";
        }
        console.error(`[FeishuWs] 机器人 "${name}" (${app_id}) 长连接启动失败:`, error);
      }
    }
  } catch (error) {
    console.error("[FeishuWs] 启动飞书长连接异常:", error);
  }
}

// === 停止长连接 ===

/**
 * 停止所有飞书长连接
 * 应在服务关闭时调用（instrumentation.ts gracefulShutdown）
 */
export async function stopFeishuWsClients(): Promise<void> {
  try {
    for (const [appId, ws] of wsClients) {
      ws.close({ force: true });
      const state = clientStates.get(appId);
      if (state) {
        state.status = "disconnected";
        state.connectedAt = null;
      }
    }
    wsClients.clear();
    larkClients.clear();

    console.log("[FeishuWs] 飞书长连接已停止");
  } catch (error) {
    console.error("[FeishuWs] 停止飞书长连接异常:", error);
  }
}

// === 重新连接 ===

/**
 * 重新启动飞书长连接（配置变更后调用）
 */
export async function restartFeishuWsClients(): Promise<void> {
  await stopFeishuWsClients();
  clientStates.clear();
  await startFeishuWsClients();
}