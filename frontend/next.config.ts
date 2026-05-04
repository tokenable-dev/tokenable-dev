import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

/** Absolute path to this config file — pins Turbopack project root (avoids scanning parent monorepo / pnpm cache dirs). */
const FRONTEND_ROOT = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Docker 컨테이너 배포를 위한 standalone 빌드
  // node_modules 없이 최소한의 파일만으로 실행 가능한 이미지 생성
  output: "standalone",
  turbopack: {
    root: FRONTEND_ROOT,
  },
  /** 브라우저를 동일 출처 `/api`로 두고 백엔드로 프록시 → httpOnly 쿠키(JWT) 전달 */
  async rewrites() {
    const target = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";
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
    ],
  },
  /**
   * Wagmi connectors package re-exports optional wallet connectors.
   * In this app we only use MetaMask, so silence unresolved optional peers.
   */
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@react-native-async-storage/async-storage": false,
      "@base-org/account": false,
      "@coinbase/wallet-sdk": false,
      porto: false,
      "porto/internal": false,
      "@safe-global/safe-apps-sdk": false,
      "@safe-global/safe-apps-provider": false,
      "@walletconnect/ethereum-provider": false,
    };
    return config;
  },
};

export default nextConfig;
