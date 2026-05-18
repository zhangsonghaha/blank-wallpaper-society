import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit-log";

// === 类型 ===

interface ProviderRow {
  id: number;
  name: string;
  type: string;
  base_url: string;
  api_key: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface ModelRow {
  id: number;
  provider_id: number;
  model_id: string;
  display_name: string | null;
  model_type: string;
  enabled: number;
  is_default: number;
  max_tokens: number;
  extra_config: string | null;
  created_at: string;
  updated_at: string;
}

// GET /api/admin/models - 获取所有提供商和模型
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const providers = (await query(
      "SELECT * FROM ai_model_providers ORDER BY created_at DESC"
    )) as ProviderRow[];

    const models = (await query(
      "SELECT m.*, p.name AS provider_name, p.type AS provider_type, p.base_url AS provider_base_url FROM ai_models m LEFT JOIN ai_model_providers p ON m.provider_id = p.id ORDER BY m.model_type, m.created_at DESC"
    )) as (ModelRow & { provider_name: string; provider_type: string; provider_base_url: string })[];

    // 脱敏 api_key
    const safeProviders = providers.map((p) => ({
      ...p,
      api_key: p.api_key ? p.api_key.slice(0, 8) + "****" + p.api_key.slice(-4) : "",
    }));

    return NextResponse.json({ providers: safeProviders, models });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/models - 创建提供商或模型
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const body = await request.json();
    const action = body.action; // "add_provider" | "add_model" | "test_and_add" | "set_default"

    if (action === "add_provider") {
      const { name, type, base_url, api_key, enabled } = body;
      if (!name || !base_url || !api_key) {
        return NextResponse.json({ error: "名称、Base URL和API Key为必填" }, { status: 400 });
      }

      const result = await query(
        "INSERT INTO ai_model_providers (name, type, base_url, api_key, enabled) VALUES (?, ?, ?, ?, ?)",
        [name, type || "openai", base_url, api_key, enabled !== undefined ? enabled : 1]
      ) as any;

      logAudit({
        operatorId: (session.user as any).id,
        operation: "ai_provider_create",
        detail: { name, type },
        ip: request.headers.get("x-forwarded-for") || undefined,
      }).catch(() => {});

      return NextResponse.json({ message: "提供商已创建", id: result.insertId });
    }

    if (action === "add_model") {
      const { provider_id, model_id, display_name, model_type, enabled, max_tokens, extra_config } = body;
      if (!provider_id || !model_id) {
        return NextResponse.json({ error: "提供商和模型ID为必填" }, { status: 400 });
      }

      const result = await query(
        "INSERT INTO ai_models (provider_id, model_id, display_name, model_type, enabled, max_tokens, extra_config) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          provider_id,
          model_id,
          display_name || model_id,
          model_type || "chat",
          enabled !== undefined ? enabled : 1,
          max_tokens || 4096,
          extra_config ? JSON.stringify(extra_config) : null,
        ]
      ) as any;

      logAudit({
        operatorId: (session.user as any).id,
        operation: "ai_model_create",
        detail: { provider_id, model_id, model_type },
        ip: request.headers.get("x-forwarded-for") || undefined,
      }).catch(() => {});

      return NextResponse.json({ message: "模型已添加", id: result.insertId });
    }

    if (action === "test_and_add") {
      // 测试API Key并自动发现可用模型，一键添加
      const { provider_id } = body;
      if (!provider_id) {
        return NextResponse.json({ error: "缺少提供商ID" }, { status: 400 });
      }

      const providers = (await query(
        "SELECT * FROM ai_model_providers WHERE id = ?",
        [provider_id]
      )) as ProviderRow[];

      if (providers.length === 0) {
        return NextResponse.json({ error: "提供商不存在" }, { status: 404 });
      }

      const provider = providers[0];
      const baseUrl = provider.base_url.replace(/\/+$/, "");

      try {
        let discoveredModels: { id: string; type: "chat" | "image" | "embedding" }[] = [];

        if (provider.type === "stability") {
          const res = await fetch(`${baseUrl}/engines/list`, {
            headers: { Authorization: `Bearer ${provider.api_key}` },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return NextResponse.json({
              success: false,
              error: `连接失败 (${res.status}): ${err.message || res.statusText}`,
            });
          }
          const data = await res.json();
          discoveredModels = (data || []).map((e: any) => ({
            id: e.id,
            type: "image" as const,
          }));
        } else {
          // OpenAI 兼容 API
          const res = await fetch(`${baseUrl}/models`, {
            headers: { Authorization: `Bearer ${provider.api_key}` },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return NextResponse.json({
              success: false,
              error: `连接失败 (${res.status}): ${err.error?.message || res.statusText}`,
            });
          }
          const data = await res.json();
          const modelList: string[] = (data.data || []).map((m: any) => m.id);

          // 智能分类模型
          discoveredModels = modelList.map((id: string) => {
            const lower = id.toLowerCase();
            if (
              lower.includes("dall-e") || lower.includes("stable") ||
              lower.includes("flux") || lower.includes("midjourney") ||
              lower.includes("sdxl") || lower.includes("imagen") ||
              lower.includes("image") || lower.includes("paint") ||
              lower.includes("wanx") || lower.includes("cogview") ||
              lower.includes("sensenova-u") || lower.includes("kolors")
            ) {
              return { id, type: "image" as const };
            }
            if (lower.includes("embed") || lower.includes("embedding") || lower.includes("text-embedding")) {
              return { id, type: "embedding" as const };
            }
            return { id, type: "chat" as const };
          });
        }

        // 添加发现的模型（跳过已存在的）
        let addedCount = 0;
        let skippedCount = 0;
        for (const model of discoveredModels) {
          const existing = (await query(
            "SELECT id FROM ai_models WHERE provider_id = ? AND model_id = ?",
            [provider_id, model.id]
          )) as any[];
          if (existing.length > 0) {
            skippedCount++;
            continue;
          }
          await query(
            "INSERT INTO ai_models (provider_id, model_id, display_name, model_type, enabled, max_tokens) VALUES (?, ?, ?, ?, 1, ?)",
            [provider_id, model.id, model.id, model.type, model.type === "chat" ? 4096 : model.type === "image" ? 0 : 2048]
          );
          addedCount++;
        }

        logAudit({
          operatorId: (session.user as any).id,
          operation: "ai_model_auto_discover",
          detail: { provider_id, provider_name: provider.name, added: addedCount, skipped: skippedCount },
          ip: request.headers.get("x-forwarded-for") || undefined,
        }).catch(() => {});

        return NextResponse.json({
          success: true,
          message: `发现 ${discoveredModels.length} 个模型，新增 ${addedCount} 个，跳过 ${skippedCount} 个已存在的`,
          total: discoveredModels.length,
          added: addedCount,
          skipped: skippedCount,
          models: discoveredModels,
        });
      } catch (error: any) {
        if (error.name === "TimeoutError") {
          return NextResponse.json({ success: false, error: "连接超时(15秒)，请检查URL是否正确" });
        }
        return NextResponse.json({ success: false, error: error.message || "测试失败" });
      }
    }

    if (action === "set_default") {
      const { model_id, model_type, bot_config_id } = body;
      if (!model_id || !model_type) {
        return NextResponse.json({ error: "模型ID和类型为必填" }, { status: 400 });
      }

      // 清除同类型其他默认
      await query("UPDATE ai_models SET is_default = 0 WHERE model_type = ?", [model_type]);
      // 设置新默认
      await query("UPDATE ai_models SET is_default = 1 WHERE id = ?", [model_id]);

      // 如果指定了bot_config_id，也更新bot_configs
      if (bot_config_id) {
        const field = model_type === "chat" ? "default_chat_model_id" : "default_image_model_id";
        await query(`UPDATE bot_configs SET ${field} = ? WHERE id = ?`, [model_id, bot_config_id]);
      }

      logAudit({
        operatorId: (session.user as any).id,
        operation: "ai_model_set_default",
        detail: { model_id, model_type, bot_config_id },
        ip: request.headers.get("x-forwarded-for") || undefined,
      }).catch(() => {});

      return NextResponse.json({ message: "默认模型已设置" });
    }

    if (action === "test_api_key") {
      // 测试API Key是否可用
      const { base_url, api_key, type } = body;
      if (!base_url || !api_key) {
        return NextResponse.json({ error: "Base URL和API Key为必填" }, { status: 400 });
      }

      const baseUrl = base_url.replace(/\/+$/, "");
      try {
        if (type === "stability") {
          const res = await fetch(`${baseUrl}/engines/list`, {
            headers: { Authorization: `Bearer ${api_key}` },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return NextResponse.json({ success: false, error: `认证失败 (${res.status})` });
          }
          return NextResponse.json({ success: true, message: "API Key 验证成功" });
        } else {
          const res = await fetch(`${baseUrl}/models`, {
            headers: { Authorization: `Bearer ${api_key}` },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return NextResponse.json({ success: false, error: `认证失败 (${res.status}): ${err.error?.message || res.statusText}` });
          }
          const data = await res.json();
          const modelCount = (data.data || []).length;
          return NextResponse.json({ success: true, message: `API Key 验证成功，发现 ${modelCount} 个模型` });
        }
      } catch (error: any) {
        if (error.name === "TimeoutError") {
          return NextResponse.json({ success: false, error: "连接超时(15秒)" });
        }
        return NextResponse.json({ success: false, error: error.message || "测试失败" });
      }
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/admin/models - 更新提供商或模型
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const body = await request.json();
    const target = body.target; // "provider" | "model"

    if (target === "provider") {
      const { id, name, type, base_url, api_key, enabled } = body;
      if (!id) return NextResponse.json({ error: "缺少ID" }, { status: 400 });

      const existing = (await query("SELECT id FROM ai_model_providers WHERE id = ?", [id])) as any[];
      if (existing.length === 0) return NextResponse.json({ error: "提供商不存在" }, { status: 404 });

      // 如果不传 api_key，保留原有值
      if (!api_key) {
        const row = (await query("SELECT api_key FROM ai_model_providers WHERE id = ?", [id])) as any[];
        if (row.length > 0 && row[0].api_key) {
          // 不更新 api_key
          await query(
            "UPDATE ai_model_providers SET name = ?, type = ?, base_url = ?, enabled = ? WHERE id = ?",
            [name, type, base_url, enabled !== undefined ? enabled : 1, id]
          );
        } else {
          await query(
            "UPDATE ai_model_providers SET name = ?, type = ?, base_url = ?, api_key = ?, enabled = ? WHERE id = ?",
            [name, type, base_url, api_key || "", enabled !== undefined ? enabled : 1, id]
          );
        }
      } else {
        await query(
          "UPDATE ai_model_providers SET name = ?, type = ?, base_url = ?, api_key = ?, enabled = ? WHERE id = ?",
          [name, type, base_url, api_key, enabled !== undefined ? enabled : 1, id]
        );
      }

      return NextResponse.json({ message: "提供商已更新" });
    }

    if (target === "model") {
      const { id, model_id, display_name, model_type, enabled, max_tokens, extra_config } = body;
      if (!id) return NextResponse.json({ error: "缺少ID" }, { status: 400 });

      const existing = (await query("SELECT id FROM ai_models WHERE id = ?", [id])) as any[];
      if (existing.length === 0) return NextResponse.json({ error: "模型不存在" }, { status: 404 });

      await query(
        "UPDATE ai_models SET model_id = ?, display_name = ?, model_type = ?, enabled = ?, max_tokens = ?, extra_config = ? WHERE id = ?",
        [
          model_id,
          display_name || model_id,
          model_type || "chat",
          enabled !== undefined ? enabled : 1,
          max_tokens || 4096,
          extra_config ? JSON.stringify(extra_config) : null,
          id,
        ]
      );

      return NextResponse.json({ message: "模型已更新" });
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/models - 删除提供商或模型
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "无权操作" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const target = searchParams.get("target"); // "provider" | "model"
    const id = searchParams.get("id");

    if (!id || !target) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 });
    }

    if (target === "provider") {
      // 关联模型会级联删除
      await query("DELETE FROM ai_model_providers WHERE id = ?", [Number(id)]);
      return NextResponse.json({ message: "提供商及关联模型已删除" });
    }

    if (target === "model") {
      await query("DELETE FROM ai_models WHERE id = ?", [Number(id)]);
      return NextResponse.json({ message: "模型已删除" });
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}