# ── Stage 1: 의존성 설치 ─────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

ENV CI=true

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: 빌드 ────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env (NEXT_PUBLIC_* 는 빌드 시 번들에 정적 포함)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_RWA_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_USDC_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_ALCHEMY_RPC_URL
ARG NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT
ARG NEXT_PUBLIC_PLATFORM_FEE_BPS

# Empty NEXT_PUBLIC_API_URL ⇒ browser uses same-origin /api (works for IP, domain, https).
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_RWA_CONTRACT_ADDRESS=$NEXT_PUBLIC_RWA_CONTRACT_ADDRESS
ENV NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=$NEXT_PUBLIC_USDC_CONTRACT_ADDRESS
ENV NEXT_PUBLIC_ALCHEMY_RPC_URL=$NEXT_PUBLIC_ALCHEMY_RPC_URL
ENV NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT=$NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT
ENV NEXT_PUBLIC_PLATFORM_FEE_BPS=$NEXT_PUBLIC_PLATFORM_FEE_BPS

# Required addresses must be non-empty at docker build (otherwise client bundle ships with a runtime crash).
RUN if [ -z "${NEXT_PUBLIC_RWA_CONTRACT_ADDRESS:-}" ]; then \
  echo "ERROR: NEXT_PUBLIC_RWA_CONTRACT_ADDRESS must be non-empty at docker build."; \
  exit 1; \
fi
RUN if [ -z "${NEXT_PUBLIC_USDC_CONTRACT_ADDRESS:-}" ]; then \
  echo "ERROR: NEXT_PUBLIC_USDC_CONTRACT_ADDRESS must be non-empty at docker build."; \
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
