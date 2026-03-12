"use client";

import Link from "next/link";
import { ASSETS } from "@/constants/assets";

interface LogoProps {
  /** "full" = 풀 로고, "icon" = 아이콘만 */
  variant?: "full" | "icon";
  /** 링크 (기본: /) */
  href?: string;
  /** 추가 className */
  className?: string;
  /** 아이콘/로고 높이 (px) */
  height?: number;
}

export function Logo({
  variant = "full",
  href = "/",
  className = "",
  height = 32,
}: LogoProps) {
  const src = variant === "full" ? ASSETS.logo.skyand : ASSETS.icons.skyand;
  const width = variant === "full" ? height * (186 / 37) : height;

  const img = (
    <img
      src={src}
      alt="SKYAND"
      width={width}
      height={height}
      className={`invert ${className}`}
    />
  );

  return href ? (
    <Link href={href} className="flex items-center shrink-0">
      {img}
    </Link>
  ) : (
    img
  );
}
