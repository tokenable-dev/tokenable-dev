"use client";

import Image from "next/image";

/** Safe vault thumbnail — empty/missing URLs must not hit next/image. */
export function VaultThumb({
  src,
  width,
  height,
  className,
  alt = "",
}: {
  src: string | null | undefined;
  width: number;
  height: number;
  className?: string;
  alt?: string;
}) {
  const url = src?.trim() ?? "";
  if (!url) {
    return (
      <div
        className={className}
        style={{ width, height, background: "#141416" }}
        aria-hidden
      />
    );
  }

  return (
    <Image
      src={url}
      alt={alt}
      width={width}
      height={height}
      className={className}
      unoptimized
    />
  );
}
