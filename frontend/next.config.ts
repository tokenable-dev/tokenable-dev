import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 컨테이너 배포를 위한 standalone 빌드
  // node_modules 없이 최소한의 파일만으로 실행 가능한 이미지 생성
  output: "standalone",
  /** 브라우저를 동일 출처 `/api`로 두고 백엔드로 프록시 → httpOnly 쿠키(JWT) 전달 */
  async rewrites() {
    const target = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
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
};

export default nextConfig;
