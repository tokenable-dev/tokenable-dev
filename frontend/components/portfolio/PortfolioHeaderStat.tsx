import type { ReactNode } from "react";

export function PortfolioHeaderStat({
  label,
  value,
  tone = "neutral",
}: {
  label: ReactNode;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-400/90"
      : tone === "negative"
        ? "text-red-400/90"
        : "text-zinc-100";

  return (
    <div className="flex flex-col items-end gap-1 text-right sm:gap-2">
      <p className="text-xs font-medium leading-tight text-zinc-500 sm:text-sm">{label}</p>
      <p
        className={`text-base font-semibold tabular-nums tracking-tight sm:text-2xl ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}
