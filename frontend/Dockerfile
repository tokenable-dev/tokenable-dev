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
# NEXT_PUBLIC_API_URL: omit / empty → browser uses same-origin /api for whatever host (IP or domain).
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_RWA_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_NFT_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_USDC_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_MARKETPLACE_ADDRESS
ARG NEXT_PUBLIC_PINATA_GATEWAY
ARG NEXT_PUBLIC_IPFS_GATEWAY
ARG NEXT_PUBLIC_ALCHEMY_RPC_URL
# "false" 로 설정 시 헤더의 Log in / Sign up 숨김 (IP 배포·OAuth 미구성 시)
ARG NEXT_PUBLIC_SHOW_AUTH_LINKS
# 플랫폼 수수료 — vault 지갑 + basis points (500 = 5%)
ARG NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT
ARG NEXT_PUBLIC_PLATFORM_FEE_BPS

# Empty NEXT_PUBLIC_API_URL: browser uses same-origin /api (IP or domain).
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_RWA_CONTRACT_ADDRESS=$NEXT_PUBLIC_RWA_CONTRACT_ADDRESS
ENV NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=$NEXT_PUBLIC_NFT_CONTRACT_ADDRESS
ENV NEXT_PUBLIC_USDC_CONTRACT_ADDRESS=$NEXT_PUBLIC_USDC_CONTRACT_ADDRESS
ENV NEXT_PUBLIC_MARKETPLACE_ADDRESS=$NEXT_PUBLIC_MARKETPLACE_ADDRESS
ENV NEXT_PUBLIC_PINATA_GATEWAY=$NEXT_PUBLIC_PINATA_GATEWAY
ENV NEXT_PUBLIC_IPFS_GATEWAY=${NEXT_PUBLIC_IPFS_GATEWAY:-ipfs.io}
ENV NEXT_PUBLIC_ALCHEMY_RPC_URL=$NEXT_PUBLIC_ALCHEMY_RPC_URL
ENV NEXT_PUBLIC_SHOW_AUTH_LINKS=$NEXT_PUBLIC_SHOW_AUTH_LINKS
ENV NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT=$NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT
ENV NEXT_PUBLIC_PLATFORM_FEE_BPS=$NEXT_PUBLIC_PLATFORM_FEE_BPS

# 빈 주소로 번들이 나가면 브라우저에서만 터지므로, 여기서 막음 (CI Secrets/Variables 확인)
RUN if [ -z "${NEXT_PUBLIC_RWA_CONTRACT_ADDRESS:-}" ] && [ -z "${NEXT_PUBLIC_NFT_CONTRACT_ADDRESS:-}" ]; then \
  echo "ERROR: NEXT_PUBLIC_RWA_CONTRACT_ADDRESS or NEXT_PUBLIC_NFT_CONTRACT_ADDRESS must be non-empty at docker build."; \
  exit 1; \
fi
RUN if [ -z "${NEXT_PUBLIC_USDC_CONTRACT_ADDRESS:-}" ]; then \
  echo "ERROR: NEXT_PUBLIC_USDC_CONTRACT_ADDRESS must be non-empty at docker build."; \
  exit 1; \
fi

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
