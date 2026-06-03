import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/auth/oauth-status - 检查 OAuth 登录是否可用
export async function GET() {
  try {
    const settings = await db
      .selectFrom("system_settings")
      .select(["setting_key", "setting_value"])
      .where("setting_key", "in", [
        "google_client_id",
        "google_client_secret",
        "github_client_id",
        "github_client_secret",
      ])
      .execute();

    const settingMap = new Map<string, string>();
    settings.forEach((s) => settingMap.set(s.setting_key, s.setting_value || ""));

    const googleAvailable =
      !!(process.env.GOOGLE_CLIENT_ID || settingMap.get("google_client_id")) &&
      !!(process.env.GOOGLE_CLIENT_SECRET || settingMap.get("google_client_secret"));

    const githubAvailable =
      !!(process.env.GITHUB_CLIENT_ID || settingMap.get("github_client_id")) &&
      !!(process.env.GITHUB_CLIENT_SECRET || settingMap.get("github_client_secret"));

    return NextResponse.json({
      google: googleAvailable,
      github: githubAvailable,
    });
  } catch {
    return NextResponse.json({
      google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    });
  }
}
