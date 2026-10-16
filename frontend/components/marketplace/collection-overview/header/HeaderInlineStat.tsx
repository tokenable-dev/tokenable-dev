import type { CollectionOverviewStat } from "../types";

export function HeaderInlineStat({ stat }: { stat: CollectionOverviewStat }) {
  const toneClass =
    stat.tone === "up"
      ? "text-pos"
      : stat.tone === "down"
        ? "text-neg"
        : "text-zinc-100";
  return (
    <div className="flex min-w-[4.25rem] shrink-0 flex-col gap-0.5 sm:min-w-[5rem]">
      <p className="whitespace-nowrap text-[9px] font-medium uppercase tracking-wide text-zinc-500">
        {stat.label}
      </p>
      <p className={`text-sm font-semibold tabular-nums leading-tight ${toneClass}`}>
        {stat.value}
      </p>
      {stat.sub ? (
        <p className="max-w-[8.5rem] truncate text-[9px] leading-snug text-zinc-600 sm:max-w-none">
          {stat.sub}
        </p>
      ) : null}
    </div>
  );
}
