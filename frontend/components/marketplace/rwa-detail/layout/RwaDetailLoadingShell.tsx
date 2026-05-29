"use client";

export function RwaDetailLoadingShell() {
  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.62fr)] lg:gap-x-10">
      <div className="aspect-[3/4] max-h-[min(76vh,700px)] w-full animate-pulse rounded-2xl bg-gray-800/90 sm:max-h-[min(78vh,760px)]" />
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="h-7 animate-pulse rounded bg-gray-800"
            style={{ width: `${80 - i * 8}%` }}
          />
        ))}
      </div>
    </div>
  );
}
