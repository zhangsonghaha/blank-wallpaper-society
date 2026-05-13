import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { query } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        // 动态导入 crypto（避免 Edge Runtime 加载 Node 模块）
        const crypto = await import("crypto");

        if (!credentials?.email || !credentials?.password) {
          throw new Error("请填写邮箱和密码");
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const rows = (await query("SELECT * FROM users WHERE email = ?", [
          email,
        ])) as any[];

        if (rows.length === 0) {
          throw new Error("邮箱或密码错误");
        }

        const user = rows[0];
        const hash = crypto
          .createHash("sha256")
          .update(password)
          .digest("hex");

        if (hash !== user.password) {
          throw new Error("邮箱或密码错误");
        }

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          image: user.avatar,
          role: user.role,
        };
      },
    }),
  ],
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
      }
      return session;
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
  secret: process.env.AUTH_SECRET || "image-gallery-secret-key-2026",
});