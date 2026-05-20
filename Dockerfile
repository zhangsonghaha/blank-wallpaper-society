# Stage 1: deps - 安装依赖
FROM node:20-alpine AS deps

# 安装 libc6-compat 以兼容 Alpine
RUN apk add --no-cache libc6-compat

WORKDIR /app

# 复制依赖清单
COPY package.json pnpm-lock.yaml ./

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 安装生产依赖
RUN pnpm install --frozen-lockfile --prod=false

# Stage 2: builder - 构建应用
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 从 deps 阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 构建时需要的环境变量（NextAuth 需要NEXTAUTH_URL）
# 实际构建时通过 --build-arg 或 .env 传入
ARG NEXTAUTH_URL=http://localhost:3000
ENV NEXTAUTH_URL=$NEXTAUTH_URL

# Next.js 收集完全匿名的遥测数据，可选择禁用
ENV NEXT_TELEMETRY_DISABLED=1

# 执行构建
RUN pnpm build

# Stage 3: runner - 生产运行时
FROM node:20-alpine AS runner

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 复制构建产物（standalone 模式输出）
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 设置正确的文件所有权
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置端口环境变量
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动应用（standalone 模式的入口点）
CMD ["node", "server.js"]