# ── Stage 1: 의존성 설치 ─────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: 빌드 ────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 빌드 시점 환경변수 (NEXT_PUBLIC_* 는 빌드 시 번들에 포함됨)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_NFT_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_USDC_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_MARKETPLACE_ADDRESS
ARG NEXT_PUBLIC_PINATA_GATEWAY
ARG NEXT_PUBLIC_ALCHEMY_RPC_URL
# "false" 로 설정 시 헤더의 Log in / Sign up 숨김 (IP 배포·OAuth 미구성 시)
ARG NEXT_PUBLIC_SHOW_AUTH_LINKS

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=$NEXT_PUBLIC_NFT_CONTRACT_ADDRESS
ENV NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=$NEXT_PUBLIC_USDC_CONTRACT_ADDRESS
ENV NEXT_PUBLIC_MARKETPLACE_ADDRESS=$NEXT_PUBLIC_MARKETPLACE_ADDRESS
ENV NEXT_PUBLIC_PINATA_GATEWAY=$NEXT_PUBLIC_PINATA_GATEWAY
ENV NEXT_PUBLIC_ALCHEMY_RPC_URL=$NEXT_PUBLIC_ALCHEMY_RPC_URL
ENV NEXT_PUBLIC_SHOW_AUTH_LINKS=$NEXT_PUBLIC_SHOW_AUTH_LINKS

# standalone 모드로 빌드 (next.config.ts의 output: 'standalone' 필요)
RUN pnpm build

# ── Stage 3: 실행 (최소 이미지) ──────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# standalone 빌드 결과물만 복사 (node_modules 불필요)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
