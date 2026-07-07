"use client";

import { RWA_DETAIL_DESKTOP_GRID_CLASS } from "../theme";

export function RwaDetailLoadingShell() {
  return (
    <div className={`grid grid-cols-1 items-start gap-8 ${RWA_DETAIL_DESKTOP_GRID_CLASS}`}>
      <div className="rd-skeleton aspect-[3/4] max-h-[min(76vh,700px)] w-full animate-pulse sm:max-h-[min(78vh,760px)]" />
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="rd-skeleton h-7 animate-pulse"
            style={{ width: `${80 - i * 8}%` }}
          />
        ))}
      </div>
    </div>
  );
}
