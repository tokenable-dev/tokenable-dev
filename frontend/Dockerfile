# ── Stage 1: 의존성 설치 ─────────────────────────────────────────
FROM node:22-alpine AS deps
# Pin pnpm 11.x — allowBuilds in pnpm-workspace.yaml; @latest can break when pnpm bumps major.
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

WORKDIR /app

ENV CI=true

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# postinstall patches @privy-io in node_modules — needs scripts/ (not copied here yet).
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Stage 2: 빌드 ────────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Privy dist patches (package.json postinstall — skipped in deps stage).
RUN node scripts/patch-privy-isactive.mjs

# CI copies /home/ubuntu/.env.production.frontend → frontend/.env.production before `docker build`.
# Next.js loads .env.production at build and bakes NEXT_PUBLIC_* into the bundle.
RUN set -e; \
  test -f .env.production || \
    (echo "ERROR: .env.production missing — CI must copy EC2 frontend env first" && exit 1); \
  grep -Eq '^NEXT_PUBLIC_CHAIN_11155111_RPC_URL=.+' .env.production || \
    (echo "ERROR: NEXT_PUBLIC_CHAIN_11155111_RPC_URL missing" && exit 1); \
  grep -Eq '^NEXT_PUBLIC_CHAIN_11155111_RWA=.+' .env.production || \
    (echo "ERROR: NEXT_PUBLIC_CHAIN_11155111_RWA missing" && exit 1); \
  grep -Eq '^NEXT_PUBLIC_CHAIN_11155111_USDC=.+' .env.production || \
    (echo "ERROR: NEXT_PUBLIC_CHAIN_11155111_USDC missing" && exit 1); \
  grep -Eq '^NEXT_PUBLIC_PRIVY_APP_ID=.+' .env.production || \
    (echo "ERROR: NEXT_PUBLIC_PRIVY_APP_ID missing" && exit 1)

# `next.config.ts` rewrites: same-origin `/api` → Nest. Baked at **build** time.
ARG API_PROXY_TARGET=http://127.0.0.1:4000
ENV API_PROXY_TARGET=${API_PROXY_TARGET}

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
