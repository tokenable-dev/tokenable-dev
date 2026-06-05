import type { ReactNode } from "react";

export function PortfolioHeaderStat({
  label,
  value,
  tone = "neutral",
  align = "end",
}: {
  label: ReactNode;
  value: string;
  tone?: "neutral" | "positive" | "negative";
  align?: "start" | "center" | "end";
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-400/90"
      : tone === "negative"
        ? "text-red-400/90"
        : "text-zinc-100";

  const alignCls =
    align === "center"
      ? "items-center text-center"
      : align === "start"
        ? "items-start text-left"
        : "items-end text-right";

  return (
    <div className={`flex flex-col gap-1 sm:gap-2 ${alignCls}`}>
      <p className="text-[10px] font-medium leading-tight text-zinc-500 sm:text-sm">{label}</p>
      <p
        className={`text-sm font-semibold tabular-nums tracking-tight sm:text-2xl ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}
