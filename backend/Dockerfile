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

# nest build must emit dist/main.js (tsconfig.build.json includes only src/).
# If scripts/*.ts are compiled, output becomes dist/src/main.js and the image is unusable.
RUN pnpm build \
  && test -f dist/main.js \
  || (echo "ERROR: expected dist/main.js after nest build; found:" >&2 \
      && find dist -name 'main.js' -print >&2 \
      && ls -la dist >&2 \
      && exit 1)

# ── Stage 3: 실행 (최소 이미지) ──────────────────────────────────
FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Card Ladder dashboard indexes — Playwright (see cardladder module)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN CI= pnpm exec playwright-core install --with-deps chromium

ENV CI=true

COPY --from=builder /app/dist ./dist
RUN test -f dist/main.js

EXPOSE 4000

# Prefer flat Nest output; keep legacy fallback for older images if layout regresses.
CMD ["sh", "-c", "if [ -f dist/main.js ]; then exec node dist/main.js; elif [ -f dist/src/main.js ]; then exec node dist/src/main.js; else echo 'FATAL: no dist/main.js or dist/src/main.js' >&2; ls -la dist >&2; exit 1; fi"]
