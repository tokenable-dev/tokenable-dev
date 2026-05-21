# Debian bookworm-slim — Alpine(musl) 대비 sharp 런타임 호환성이 좋습니다.
# ── Stage 1: 의존성 설치 ─────────────────────────────────────────
FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

WORKDIR /app

ENV CI=true

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: 빌드 ────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build

# ── Stage 3: 실행 (최소 이미지) ──────────────────────────────────
FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# PSA spec scraper — Chromium must exist in the image at runtime.
# 1) PLAYWRIGHT_BROWSERS_PATH: predictable path (not only ~/.cache)
# 2) CI= empty for this RUN only — with CI=true some Playwright versions skip browser download during install
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN CI= pnpm exec playwright-core install --with-deps chromium

ENV CI=true

COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/src/main.js"]
