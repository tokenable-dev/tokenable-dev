# ── Stage 1: 의존성 설치 ─────────────────────────────────────────
FROM node:22-alpine AS deps
# Pin pnpm 11.x — allowBuilds in pnpm-workspace.yaml; @latest can break when pnpm bumps major.
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

WORKDIR /app

ENV CI=true

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: 빌드 ────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env (NEXT_PUBLIC_* 는 빌드 시 번들에 정적 포함)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CHAIN_11155111_RPC_URL
ARG NEXT_PUBLIC_CHAIN_11155111_RWA
ARG NEXT_PUBLIC_CHAIN_11155111_USDC
ARG NEXT_PUBLIC_CHAIN_1_RPC_URL
ARG NEXT_PUBLIC_CHAIN_1_RWA
ARG NEXT_PUBLIC_CHAIN_1_USDC
ARG NEXT_PUBLIC_DEFAULT_CHAIN_ID=11155111
ARG NEXT_PUBLIC_PRIVY_APP_ID
ARG NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT
ARG NEXT_PUBLIC_PLATFORM_FEE_BPS
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
# `next.config.ts` rewrites: same-origin `/api` → Nest. Baked at **build** time (not runtime).
# 예: Docker Compose 에서 서비스명이 `api` 이고 Nest 가 4000 이면
#   --build-arg API_PROXY_TARGET=http://api:4000
# 없이 빌드하면 기본 http://127.0.0.1:4000 → 프론트 단독 컨테이너에서 /api 전부 502.
ARG API_PROXY_TARGET=http://127.0.0.1:4000
ENV API_PROXY_TARGET=${API_PROXY_TARGET}

# Empty NEXT_PUBLIC_API_URL ⇒ browser uses same-origin /api (works for IP, domain, https).
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_CHAIN_11155111_RPC_URL=$NEXT_PUBLIC_CHAIN_11155111_RPC_URL
ENV NEXT_PUBLIC_CHAIN_11155111_RWA=$NEXT_PUBLIC_CHAIN_11155111_RWA
ENV NEXT_PUBLIC_CHAIN_11155111_USDC=$NEXT_PUBLIC_CHAIN_11155111_USDC
ENV NEXT_PUBLIC_CHAIN_1_RPC_URL=$NEXT_PUBLIC_CHAIN_1_RPC_URL
ENV NEXT_PUBLIC_CHAIN_1_RWA=$NEXT_PUBLIC_CHAIN_1_RWA
ENV NEXT_PUBLIC_CHAIN_1_USDC=$NEXT_PUBLIC_CHAIN_1_USDC
ENV NEXT_PUBLIC_DEFAULT_CHAIN_ID=$NEXT_PUBLIC_DEFAULT_CHAIN_ID
ENV NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID
ENV NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT=$NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT
ENV NEXT_PUBLIC_PLATFORM_FEE_BPS=$NEXT_PUBLIC_PLATFORM_FEE_BPS
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID

# Sepolia (11155111) must be fully configured — otherwise client bundle crashes at runtime.
RUN if [ -z "${NEXT_PUBLIC_CHAIN_11155111_RPC_URL:-}" ]; then \
  echo "ERROR: NEXT_PUBLIC_CHAIN_11155111_RPC_URL must be non-empty at docker build."; \
  exit 1; \
fi
RUN if [ -z "${NEXT_PUBLIC_CHAIN_11155111_RWA:-}" ]; then \
  echo "ERROR: NEXT_PUBLIC_CHAIN_11155111_RWA must be non-empty at docker build."; \
  exit 1; \
fi
RUN if [ -z "${NEXT_PUBLIC_CHAIN_11155111_USDC:-}" ]; then \
  echo "ERROR: NEXT_PUBLIC_CHAIN_11155111_USDC must be non-empty at docker build."; \
  exit 1; \
fi
RUN if [ -z "${NEXT_PUBLIC_PRIVY_APP_ID:-}" ]; then \
  echo "ERROR: NEXT_PUBLIC_PRIVY_APP_ID must be non-empty at docker build (Privy login/wallets)."; \
  exit 1; \
fi

# Standalone build (next.config.ts → output: 'standalone')
RUN pnpm build

# ── Stage 3: 실행 (최소 이미지) ──────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
