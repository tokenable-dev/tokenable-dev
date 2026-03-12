import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 컨테이너 배포를 위한 standalone 빌드
  // node_modules 없이 최소한의 파일만으로 실행 가능한 이미지 생성
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.mypinata.cloud",
      },
      {
        protocol: "https",
        hostname: "ipfs.io",
      },
    ],
  },
};

export default nextConfig;
