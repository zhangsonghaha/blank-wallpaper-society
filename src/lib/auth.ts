import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sql } from "kysely";
import { checkLoginLock, recordLoginFailure, clearLoginFailures } from "@/lib/login-security";
import { hashPassword, verifyPassword } from "@/lib/password";

// Auth Secret：优先 AUTH_SECRET，其次 NEXTAUTH_SECRET，都不存在时自动生成
// 注意：自动生成的密钥在每次部署/重启时变化，会导致已有会话失效
// 生产环境请务必在环境变量中设置 AUTH_SECRET
const authSecret: string =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (() => {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[auth] ⚠️ AUTH_SECRET 和 NEXTAUTH_SECRET 均未设置，使用随机密钥。" +
        "每次重启/HMR 会导致已有会话失效。请在 .env.local 中设置 AUTH_SECRET。"
      );
    }
    return crypto.randomBytes(32).toString("hex");
  })();

// OAuth 凭据：优先环境变量，其次数据库设置
async function getOAuthConfig() {
  let googleClientId = process.env.GOOGLE_CLIENT_ID || "";
  let googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  let githubClientId = process.env.GITHUB_CLIENT_ID || "";
  let githubClientSecret = process.env.GITHUB_CLIENT_SECRET || "";

  try {
    const keys = ["google_client_id", "google_client_secret", "github_client_id", "github_client_secret", "google_login_enabled", "github_login_enabled"];
    const settings = await db
      .selectFrom("system_settings")
      .select(["setting_key", "setting_value"])
      .where("setting_key", "in", keys)
      .execute();

    const settingMap = new Map<string, string>();
    settings.forEach((s) => settingMap.set(s.setting_key, s.setting_value || ""));

    // 数据库值作为回退（环境变量优先）
    if (!googleClientId && settingMap.get("google_client_id")) {
      googleClientId = settingMap.get("google_client_id")!;
    }
    if (!googleClientSecret && settingMap.get("google_client_secret")) {
      googleClientSecret = settingMap.get("google_client_secret")!;
    }
    if (!githubClientId && settingMap.get("github_client_id")) {
      githubClientId = settingMap.get("github_client_id")!;
    }
    if (!githubClientSecret && settingMap.get("github_client_secret")) {
      githubClientSecret = settingMap.get("github_client_secret")!;
    }

    return { googleClientId, googleClientSecret, githubClientId, githubClientSecret };
  } catch {
    return { googleClientId, googleClientSecret, githubClientId, githubClientSecret };
  }
}

// 构建 providers（异步获取数据库配置）
async function buildProviders() {
  const providers: any[] = [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("请填写邮箱和密码");
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // 检查登录锁定
        const lockStatus = checkLoginLock(email);
        if (lockStatus.locked) {
          const minutes = Math.ceil(lockStatus.remainingSeconds / 60);
          throw new Error(`账号已被临时锁定，请${minutes}分钟后重试`);
        }

        const rows = await db
          .selectFrom("users")
          .where("email", "=", email)
          .selectAll()
          .execute();

        if (rows.length === 0) {
          recordLoginFailure(email);
          throw new Error("邮箱或密码错误");
        }

        const user = rows[0];
        const { valid, upgradedHash } = await verifyPassword(password, user.password);

        if (!valid) {
          const failResult = recordLoginFailure(email);
          if (failResult.locked) {
            throw new Error("账号已被临时锁定，请15分钟后重试");
          }
          throw new Error("邮箱或密码错误");
        }

        // 自动升级旧 SHA-256 哈希为 bcrypt
        if (upgradedHash) {
          db.updateTable("users")
            .set({ password: upgradedHash })
            .where("id", "=", user.id)
            .execute()
            .catch((err) => console.error("[auth] 密码哈希升级失败:", err));
        }

        // 检查账号状态
        if (user.status === "suspended") {
          throw new Error("账号已被封禁");
        }
        if (user.status === "pending_deletion") {
          throw new Error("账号正在注销中");
        }
        if (user.status === "deleted") {
          throw new Error("账号已注销");
        }
        if (user.status === "banned") {
          throw new Error("账号已被封禁");
        }

        // 登录成功，清除失败记录
        clearLoginFailures(email);

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          image: user.avatar,
          role: user.role,
        };
      },
    }),
  ];

  const config = await getOAuthConfig();

  // 仅在凭据完整时添加 Google provider
  if (config.googleClientId && config.googleClientSecret) {
    providers.push(Google({
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
    }));
  }

  // 仅在凭据完整时添加 GitHub provider
  if (config.githubClientId && config.githubClientSecret) {
    providers.push(GitHub({
      clientId: config.githubClientId,
      clientSecret: config.githubClientSecret,
    }));
  }

  return providers;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: await buildProviders(),
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        // 查询会员信息
        try {
          const userId = parseInt(token.id as string);
          if (userId) {
            const m = await db
              .selectFrom("memberships")
              .select(["plan", "started_at", "expires_at", "status"])
              .where("user_id", "=", userId)
              .where("status", "=", "active")
              .limit(1)
              .executeTakeFirst();
            if (m) {
              (session.user as any).membership = {
                plan: m.plan,
                startedAt: m.started_at,
                expiresAt: m.expires_at,
                status: m.status,
              };
            } else {
              (session.user as any).membership = null;
            }
          }
        } catch {
          (session.user as any).membership = null;
        }
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // OAuth 登录处理
      if (account?.provider === "google" || account?.provider === "github") {
        const email = user.email;
        if (!email) {
          throw new Error("无法获取邮箱信息");
        }

        // 检查是否已有该邮箱的用户
        const existingUsers = await db
          .selectFrom("users")
          .where("email", "=", email)
          .selectAll()
          .execute();

        let userId: number;

        if (existingUsers.length > 0) {
          // 已有用户，关联 OAuth 账号
          // 检查账号状态
          const existingUser = existingUsers[0];
          if (existingUser.status === "suspended" || existingUser.status === "banned") {
            throw new Error("账号已被封禁");
          }
          if (existingUser.status === "pending_deletion") {
            throw new Error("账号正在注销中");
          }
          if (existingUser.status === "deleted") {
            throw new Error("账号已注销");
          }
          userId = existingUsers[0].id;
        } else {
          // 新用户，自动注册
          const crypto = await import("crypto");
          const randomPassword = crypto.randomBytes(32).toString("hex");
          const hashedPassword = await hashPassword(randomPassword);

          const name = user.name || email.split("@")[0];
          const avatar = user.image || null;

          const result = await db
            .insertInto("users")
            .values({ email, name, password: hashedPassword, avatar, role: "user" })
            .executeTakeFirst();

          userId = Number(result.insertId);
        }

        // 保存/更新 OAuth 关联
        await sql`
          INSERT INTO oauth_accounts (user_id, provider, provider_account_id, access_token, refresh_token)
          VALUES (${userId}, ${account.provider}, ${account.providerAccountId}, ${account.access_token || null}, ${account.refresh_token || null})
          ON DUPLICATE KEY UPDATE access_token = VALUES(access_token), refresh_token = VALUES(refresh_token), updated_at = NOW()
        `.execute(db);

        // 设置用户信息供后续 callback 使用
        const dbUser = await db
          .selectFrom("users")
          .where("id", "=", userId)
          .selectAll()
          .execute();

        if (dbUser.length > 0) {
          (user as any).id = String(userId);
          (user as any).role = dbUser[0].role;
        }
      }

      return true;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: authSecret,
});