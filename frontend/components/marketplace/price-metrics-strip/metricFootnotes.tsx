import type { ReactNode } from "react";

export function metricFooterFromText(text: string | null | undefined): ReactNode {
  if (!text?.trim()) return undefined;
  return <span className="line-clamp-2 text-pretty">{text.trim()}</span>;
}
