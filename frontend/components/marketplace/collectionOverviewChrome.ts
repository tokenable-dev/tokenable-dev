/**
 * Visual chrome aligned with {@link CollectionCoverFrame} hero (gradient bezel + inner mat).
 * Used around the marketplace cluster on collection detail (chart · order book · trade).
 */

/** Outer gradient rim — mirrors cover `hero` outer shell. */
export const COLLECTION_MARKET_CLUSTER_BEZEL =
  "p-[4px] sm:p-[5px] rounded-[1.35rem] bg-gradient-to-br from-white/[0.085] via-zinc-800/42 to-zinc-950 shadow-[0_22px_60px_-14px_rgba(0,0,0,0.82),0_0_0_1px_rgba(255,255,255,0.06),0_0_48px_-28px_rgba(0,0,0,0.55)]";

/** Inner “mat” — dark panel with inset highlights like the cover inner frame. */
export const COLLECTION_MARKET_CLUSTER_MAT =
  "rounded-[1.2rem] bg-gradient-to-b from-zinc-900/93 via-[#0b0d12] to-[#070910] p-3 sm:p-3.5 lg:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.055),inset_0_-1px_0_rgba(0,0,0,0.42)]";

/** Nested split pane (book | trade): flush with mat — divider only between columns. */
export const COLLECTION_MARKET_SPLIT_CHROME =
  "rounded-[1.05rem] bg-[#05070c]/90 divide-x divide-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]";

/** Chart card inside the mat — no outer border (mat bezel already frames the cluster). */
export const COLLECTION_CHART_SURFACE =
  "rounded-[1.05rem] bg-[#05070c]/95 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
