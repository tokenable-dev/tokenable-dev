"use client";

import { rwaDetailRightFont } from "../theme";

export function RwaDetailListPriceDisplay({ priceUsd }: { priceUsd: number }) {
  const priceStr = priceUsd.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return (
    <p
      className={`${rwaDetailRightFont.className} text-[clamp(2.25rem,8vw,3.25rem)] font-bold leading-none tracking-tight text-white tabular-nums sm:text-[3.25rem]`}
    >
      ${priceStr}
    </p>
  );
}
