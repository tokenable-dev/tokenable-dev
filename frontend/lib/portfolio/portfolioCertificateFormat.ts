import { formatPortfolioUsd } from "@/lib/portfolio/portfolioTableHelpers";

export function formatPortfolioPassportId(tokenId: number): string {
  const n = Math.max(0, Math.floor(tokenId));
  return `TKB-${String(n).padStart(8, "0")}`;
}

export function formatWalletShort(address: string | null | undefined): string {
  const a = (address ?? "").trim();
  if (a.length < 10) return a || "—";
  return `${a.slice(0, 4)}…${a.slice(-3)}`;
}

export function formatCertDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatCertDateShort(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

export function formatExplorerAddr(addr: string): string {
  const a = addr.trim();
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function formatMarketChangePct(pct: number | null | undefined): {
  text: string;
  positive: boolean;
} | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const positive = pct >= 0;
  const abs = Math.abs(pct);
  const body = abs >= 10 ? abs.toFixed(1) : abs.toFixed(1);
  return {
    text: `${positive ? "▲" : "▼"} ${positive ? "+" : "−"}${body}%`,
    positive,
  };
}

