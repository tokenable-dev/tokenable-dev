import type { ReactNode } from "react";

const BADGE_COLORS: Record<string, string> = {
  pokemon: "#6b3a2a",
  "pokémon": "#6b3a2a",
  nba: "#2e3a6b",
  basketball: "#2e3a6b",
  mlb: "#5c4024",
  baseball: "#5c4024",
  nfl: "#4a3520",
  football: "#4a3520",
  nhl: "#2a3d4a",
  hockey: "#2a3d4a",
  soccer: "#264a3a",
  yugioh: "#4a2a5c",
  "yu-gi-oh": "#4a2a5c",
  magic: "#5c2a3a",
};

export function CollectiblePriceLine({
  label,
  children,
  title,
}: {
  label: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <p
      className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[9px] leading-tight text-gray-400 sm:text-[12px]"
      title={title}
    >
      <span className="text-gray-400">{label} : </span>
      <span className="font-semibold tabular-nums text-white">{children}</span>
    </p>
  );
}

export function CategoryBadge({ label }: { label: string }) {
  const key = label.toLowerCase().trim();
  const bg =
    Object.entries(BADGE_COLORS).find(([k]) => key.includes(k))?.[1] ?? "#3a3a3a";
  const short = label.length > 12 ? label.slice(0, 10) + "…" : label;
  return (
    <span
      className="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[9px] font-bold text-gray-300"
      style={{ backgroundColor: bg }}
    >
      {short}
    </span>
  );
}
