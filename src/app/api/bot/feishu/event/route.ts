import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { chatWithBot } from "@/lib/ai-chat";
import crypto from "crypto";

/**
 * 飞书事件回调 API
 * 处理飞书开放平台推送的事件，包括：
 * - url_verification: 初始验证
 * - im.message.receive_v1: 接收消息并自动回复
 *
 * 使用方式：将此 URL 配置到飞书开放平台应用的事件订阅中
 */

// 飞书验证 token（从数据库读取，或从环境变量读取）
function getVerificationToken(): string {
  return process.env.FEISHU_VERIFICATION_TOKEN || "";
}

// 飞书 Encrypt Key（如果配置了加密）
function getEncryptKey(): string {
  return process.env.FEISHU_ENCRYPT_KEY || "";
}

// 解密飞书事件
function decryptEvent(encrypt: string): string {
  const key = getEncryptKey();
  if (!key) return encrypt;

  const keyBuffer = Buffer.from(key, "utf8");
  const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuffer, keyBuffer);
  let decrypted = decipher.update(encrypt, "base64", "utf8");
  decrypted += decipher.final("utf8");
  const data = JSON.parse(decrypted);
  return JSON.stringify(data);
}

// GET - 健康检查
export async function GET() {
  return NextResponse.json({ status: "ok", service: "feishu-bot-event" });
}

// POST - 接收飞书事件回调
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. URL 验证（首次配置事件订阅时飞书会发送验证请求）
    if (body.type === "url_verification") {
      const token = getVerificationToken();
      if (token && body.token !== token) {
        return NextResponse.json({ error: "token verification failed" }, { status: 403 });
      }
      return NextResponse.json({ challenge: body.challenge });
    }

    // 2. 处理加密事件
    let eventBody = body;
    if (body.encrypt) {
      const decrypted = decryptEvent(body.encrypt);
      eventBody = JSON.parse(decrypted);
    }

    // 3. 验证事件签名（安全校验）
    const headerToken = request.headers.get("X-Lark-Signature") || "";
    const timestamp = request.headers.get("X-Lark-Request-Timestamp") || "";
    const nonce = request.headers.get("X-Lark-Request-Nonce") || "";

    // 4. 处理事件
    const { header, event } = eventBody;

    if (!header || !event) {
      return NextResponse.json({ error: "invalid event format" }, { status: 400 });
    }

    const eventType = header.event_type;
    const appId = header.app_id;

    // 5. 查找对应的机器人配置
    const botConfigs = (await query(
      "SELECT * FROM bot_configs WHERE type = 'feishu' AND auth_mode = 'app' AND app_id = ? AND enabled = 1",
      [appId]
    )) as any[];

    if (botConfigs.length === 0) {
      console.warn(`[FeishuBot] 未找到匹配的机器人配置: app_id=${appId}`);
      return NextResponse.json({ status: "ignored" });
    }

    const botConfig = botConfigs[0];

    // 6. 处理消息接收事件
    if (eventType === "im.message.receive_v1") {
      const message = event.message;
      const sender = event.sender;

      if (!message || !sender) {
        return NextResponse.json({ status: "ignored" });
      }

      // 忽略机器人自己发的消息，避免循环
      if (sender.sender_type === "app") {
        return NextResponse.json({ status: "ignored" });
      }

      const msgType = message.message_type;
      const chatId = message.chat_id;
      const messageId = message.message_id;

      // 只处理文本消息
      if (msgType !== "text") {
        // 非文本消息，回复提示
        await replyFeishuMessage(
          botConfig,
          chatId,
          "目前只支持文本消息对话，请发送文字与我交流~"
        );
        return NextResponse.json({ status: "processed" });
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
        await replyFeishuMessage(botConfig, chatId, "你好！有什么可以帮你的吗？");
        return NextResponse.json({ status: "processed" });
      }

      console.log(`[FeishuBot] 收到消息: chat=${chatId}, sender=${sender.sender_id?.user_id}, text=${userText.slice(0, 100)}`);

      // 7. 调用 AI 进行回复（异步，不阻塞飞书事件回调）
      const chatModelId = botConfig.default_chat_model_id || undefined;
      
      // 异步处理AI回复
      handleAiReply(botConfig, chatId, userText, chatModelId).catch((err) => {
        console.error("[FeishuBot] AI回复异常:", err);
      });

      return NextResponse.json({ status: "processing" });
    }

    // 其他事件类型忽略
    return NextResponse.json({ status: "ignored" });
  } catch (error: any) {
    console.error("[FeishuBot] 事件处理异常:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// === 飞书获取 tenant_access_token ===

async function getTenantAccessToken(appId: string, appSecret: string): Promise<string | null> {
  try {
    const res = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    if (data.code === 0 && data.tenant_access_token) {
      return data.tenant_access_token;
    }
    console.error("[FeishuBot] 获取 tenant_access_token 失败:", data);
    return null;
  } catch (error) {
    console.error("[FeishuBot] 获取 tenant_access_token 异常:", error);
    return null;
  }
}

// === 回复飞书消息 ===

async function replyFeishuMessage(
  botConfig: any,
  chatId: string,
  replyText: string
): Promise<boolean> {
  const token = await getTenantAccessToken(botConfig.app_id, botConfig.app_secret);
  if (!token) {
    console.error("[FeishuBot] 无法获取 token，回复失败");
    return false;
  }

  try {
    const res = await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: "text",
        content: JSON.stringify({ text: replyText }),
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();
    if (data.code === 0) {
      // 更新发送计数
      await query(
        "UPDATE bot_configs SET last_sent_at = NOW(), send_count = send_count + 1 WHERE id = ?",
        [botConfig.id]
      );
      return true;
    }
    console.error("[FeishuBot] 回复消息失败:", data);
    await query("UPDATE bot_configs SET fail_count = fail_count + 1 WHERE id = ?", [botConfig.id]);
    return false;
  } catch (error) {
    console.error("[FeishuBot] 回复消息异常:", error);
    await query("UPDATE bot_configs SET fail_count = fail_count + 1 WHERE id = ?", [botConfig.id]).catch(() => {});
    return false;
  }
}

// === AI 回复处理 ===

async function handleAiReply(
  botConfig: any,
  chatId: string,
  userText: string,
  chatModelId?: number
): Promise<void> {
  try {
    // 先发送"正在思考"提示
    await replyFeishuMessage(botConfig, chatId, "🤔 思考中...");

    // 调用AI获取回复
    const aiReply = await chatWithBot(userText, {
      botName: botConfig.name,
    });

    // 截断过长的回复（飞书单条消息限制）
    const maxLen = 4000;
    const replyText = aiReply.length > maxLen
      ? aiReply.slice(0, maxLen) + "\n\n...(回复过长已截断)"
      : aiReply;

    await replyFeishuMessage(botConfig, chatId, replyText);
    console.log(`[FeishuBot] AI回复成功: chat=${chatId}, len=${replyText.length}`);
  } catch (error: any) {
    console.error("[FeishuBot] AI回复处理失败:", error);
    await replyFeishuMessage(
      botConfig,
      chatId,
      "抱歉，AI服务暂时不可用，请稍后再试。"
    );
  }
}