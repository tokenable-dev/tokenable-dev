import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";
import { backendOrigin } from "./lib/core/backendOrigin";

/** Absolute path to this config file — used for webpack aliases only. */
const FRONTEND_ROOT = path.dirname(fileURLToPath(import.meta.url));

const OPTIONAL_PRIVY_PEER_STUB_ABS = path.join(
  FRONTEND_ROOT,
  "lib/stubs/optional-peer.ts",
);

/** Relative path for Turbopack resolveAlias (must be relative to project root, not absolute). */
const OPTIONAL_PRIVY_PEER_STUB_REL = "./lib/stubs/optional-peer.ts";

/** Privy optional peers — Ethernet-only app; no Farcaster mini-app / Solana / AA extras. */
const OPTIONAL_PRIVY_PEER_ALIASES_TURBO: Record<string, string> = {
  "@farcaster/mini-app-solana": OPTIONAL_PRIVY_PEER_STUB_REL,
  "@abstract-foundation/agw-client": OPTIONAL_PRIVY_PEER_STUB_REL,
  "@stripe/crypto": OPTIONAL_PRIVY_PEER_STUB_REL,
  permissionless: OPTIONAL_PRIVY_PEER_STUB_REL,
};

const OPTIONAL_PRIVY_PEER_ALIASES_WEBPACK: Record<string, string> = {
  "@farcaster/mini-app-solana": OPTIONAL_PRIVY_PEER_STUB_ABS,
  "@abstract-foundation/agw-client": OPTIONAL_PRIVY_PEER_STUB_ABS,
  "@stripe/crypto": OPTIONAL_PRIVY_PEER_STUB_ABS,
  permissionless: OPTIONAL_PRIVY_PEER_STUB_ABS,
};

const nextConfig: NextConfig = {
  // Docker 컨테이너 배포를 위한 standalone 빌드
  // node_modules 없이 최소한의 파일만으로 실행 가능한 이미지 생성
  output: "standalone",
  experimental: {
    /**
     * Tree-shakes large packages so Turbopack/Webpack only bundles the exports actually used.
     * Significant dev compile-time win for viem (350+ sub-modules), wagmi, echarts.
     */
    optimizePackageImports: [
      "viem",
      "wagmi",
      "@wagmi/core",
      "@privy-io/react-auth",
      "@privy-io/wagmi",
      "ethers",
      "@tanstack/react-query",
      "lucide-react",
      "echarts",
      "echarts-for-react",
      "date-fns",
    ],
  },
  turbopack: {
    root: FRONTEND_ROOT,
    resolveAlias: OPTIONAL_PRIVY_PEER_ALIASES_TURBO,
  },
  /**
   * 브라우저는 동일 출처 `/api`로 호출 → 여기서 Nest 로 프록시(httpOnly 쿠키 전달).
   * Standalone Docker 에서는 이 destination 이 **빌드 시점**에 고정되므로, API 컨테이너와 분리됐다면
   * `docker build --build-arg API_PROXY_TARGET=http://<nest-서비스명>:4000` 필수.
   * (기본 `127.0.0.1:4000` 이면 프론트 컨테이너 안에 백엔드가 없어 `/api` 가 전부 502 가 됨.)
   */
  async rewrites() {
    // Local dev: `app/api/[...path]/route.ts` probes Nest on 4100/4000 (no fixed LAN/loopback rewrite).
    if (process.env.NODE_ENV === "development") {
      return [];
    }
    const target = backendOrigin();
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
  async redirects() {
    return [
      {
        source: "/exchange",
        destination: "/markets",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.mypinata.cloud",
      },
      {
        protocol: "https",
        hostname: "gateway.pinata.cloud",
      },
      {
        protocol: "https",
        hostname: "ipfs.io",
      },
      {
        protocol: "https",
        hostname: "tcgplayer-cdn.tcgplayer.com",
      },
      {
        protocol: "https",
        hostname: "cdn.bubble.io",
      },
      {
        protocol: "https",
        hostname: "**.bubble.io",
      },
      {
        protocol: "https",
        hostname: "public.getcollectr.com",
      },
    ],
  },
  /**
   * Optional wagmi connector peers — stub unused SDKs pulled in by Privy/wagmi.
   */
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      ...OPTIONAL_PRIVY_PEER_ALIASES_WEBPACK,
      "@react-native-async-storage/async-storage": false,
      porto: false,
      "porto/internal": false,
      "@safe-global/safe-apps-sdk": false,
      "@safe-global/safe-apps-provider": false,
    };

    config.ignoreWarnings = [
      ...(Array.isArray(config.ignoreWarnings) ? config.ignoreWarnings : []),
      // viem → ox tempo internals use dynamic require(); harmless at runtime.
      {
        module: /node_modules[\\/]ox[\\/]/,
        message: /Critical dependency/,
      },
    ];

    return config;
  },
};

export default nextConfig;
