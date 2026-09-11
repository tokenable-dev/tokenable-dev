import { backendFetch, getApiUrl } from "./client";

export type CardladderDashboardIndexId = "pokemon" | "mlb" | "nfl" | "nba";

export type CardladderDashboardIndexRow = {
  id: CardladderDashboardIndexId;
  slug: string;
  name: string;
  changePct: number | null;
  direction: "up" | "down" | null;
};

export type CardladderIndexesResponse = {
  data: CardladderDashboardIndexRow[];
  updatedAt: string;
  source: "cardladder";
  stale: boolean;
};

export async function getCardladderIndexes(opts?: {
  refresh?: boolean;
}): Promise<CardladderIndexesResponse> {
  const sp = new URLSearchParams();
  if (opts?.refresh) sp.set("refresh", "1");
  const q = sp.toString();
  const res = await backendFetch(
    `${getApiUrl()}/cardladder/indexes${q ? `?${q}` : ""}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Card Ladder indexes (${res.status})`);
  }
  return res.json() as Promise<CardladderIndexesResponse>;
}
