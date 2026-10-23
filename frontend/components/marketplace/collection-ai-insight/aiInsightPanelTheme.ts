export type AiInsightPanelTheme = {
  sectionCard: string;
  sectionTitle: string;
  body: string;
  bodyMuted: string;
  bullet: string;
  bulletDot: string;
  metricBox: string;
  metricLabel: string;
  metricValue: string;
  chip: string;
  chipValue: string;
  scoredLabel: string;
  scoredWeight: string;
  scoredContribution: string;
  scoredRing: string;
  scoredScore: string;
  sources: string;
  emptyState: string;
  badgeAmber: string;
  badgeLive: string;
  marketTone: string;
  kicker: string;
  title: string;
  summary: string;
  priceSection: string;
  priceValue: string;
  priceChange: string;
  chartCaption: string;
  platformFooter: string;
  platformLabel: string;
  platformValue: string;
  platformMeta: string;
  ctaButton: string;
  footer: string;
  footerMeta: string;
  tableHead: string;
  tableRow: string;
  tableCell: string;
  tableCellValue: string;
  trustBox: string;
  trustLabel: string;
  trustScore: string;
  confidenceMedium: string;
  confidenceLow: string;
  confidenceHigh: string;
  accentLabel: string;
  loadingShell: string;
  loadingBlock: string;
  loadingText: string;
  expandHint: string;
  error: string;
  emptyChart: string;
  identityRow: string;
};

export const AI_INSIGHT_THEME_DARK: AiInsightPanelTheme = {
  sectionCard: "rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3",
  sectionTitle: "text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:text-sm",
  body: "text-[13px] leading-relaxed text-zinc-300 sm:text-sm",
  bodyMuted: "text-xs text-zinc-400",
  bullet:
    "flex gap-2 text-[13px] leading-relaxed text-zinc-300 sm:text-sm before:mt-2 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-mint/80 before:content-['']",
  bulletDot: "before:bg-mint/80",
  metricBox: "rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2 py-1.5",
  metricLabel: "text-[9px] uppercase text-zinc-600",
  metricValue: "text-[12px] font-semibold text-white",
  chip: "rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-[10px] text-zinc-400",
  chipValue: "font-semibold text-zinc-200",
  scoredLabel: "text-zinc-400",
  scoredWeight: "text-zinc-600",
  scoredContribution: "font-semibold text-zinc-200",
  scoredRing: "flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-mint/40 bg-mint/10",
  scoredScore: "text-lg font-bold text-mint",
  sources: "mt-2 text-[9px] leading-relaxed text-zinc-600",
  emptyState: "space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4",
  badgeAmber:
    "rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300",
  badgeLive:
    "rounded-full border border-mint/30 bg-mint/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-mint",
  marketTone: "text-[10px] text-zinc-500",
  kicker: "text-[10px] font-semibold uppercase tracking-[0.2em] text-mint/80 sm:text-xs",
  title: "text-lg font-semibold leading-snug text-white sm:text-xl",
  summary: "text-sm leading-relaxed text-zinc-300 sm:text-[15px]",
  priceSection: "rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3",
  priceValue: "text-lg font-semibold text-white",
  priceChange: "text-xs text-zinc-400",
  chartCaption: "mt-2 text-xs leading-relaxed text-zinc-500",
  platformFooter: "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-mint/20 bg-mint/[0.04] p-3",
  platformLabel: "text-[10px] uppercase tracking-wide text-zinc-500",
  platformValue: "text-sm font-semibold text-white",
  platformMeta: "text-[10px] text-zinc-500",
  ctaButton: "rounded-lg bg-mint px-4 py-2 text-xs font-bold text-[#0a0a0a] hover:bg-mint/90",
  footer: "space-y-1 border-t border-zinc-800/60 pt-2 text-[10px] leading-relaxed text-zinc-600",
  footerMeta: "text-zinc-700",
  tableHead: "border-b border-zinc-800 text-zinc-600",
  tableRow: "border-b border-zinc-900",
  tableCell: "py-2 pr-3 text-zinc-400",
  tableCellValue: "py-2 pr-3 font-semibold text-white",
  trustBox: "rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-center",
  trustLabel: "text-[9px] uppercase text-zinc-600",
  trustScore: "text-lg font-bold text-mint",
  confidenceHigh: "text-mint border-mint/30 bg-mint/10",
  confidenceMedium: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  confidenceLow: "text-zinc-400 border-zinc-600/40 bg-zinc-800/40",
  accentLabel: "mb-2 text-xs font-semibold uppercase tracking-wide text-mint/90",
  loadingShell: "ai-insight-loading-shell rounded-xl border border-mint/20 p-4",
  loadingBlock: "ai-insight-loading-block rounded bg-zinc-800/60",
  loadingText: "text-center text-[10px] font-medium uppercase tracking-widest text-mint/70",
  expandHint: "text-xs text-zinc-500",
  error: "text-xs text-neg",
  emptyChart:
    "flex h-[140px] items-center justify-center rounded-xl border border-zinc-800/80 bg-zinc-950/40 text-xs text-zinc-500",
  identityRow:
    "flex items-center justify-between rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-2",
};

export const AI_INSIGHT_THEME_LIGHT: AiInsightPanelTheme = {
  sectionCard: "rounded-lg border border-zinc-200 bg-zinc-50 p-3",
  sectionTitle: "text-xs font-semibold uppercase tracking-wide text-zinc-600 sm:text-sm",
  body: "text-[13px] leading-relaxed text-zinc-800 sm:text-sm",
  bodyMuted: "text-xs text-zinc-600",
  bullet:
    "flex gap-2 text-[13px] leading-relaxed text-zinc-800 sm:text-sm before:mt-2 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-emerald-600 before:content-['']",
  bulletDot: "before:bg-emerald-600",
  metricBox: "rounded-lg border border-zinc-200 bg-white px-2 py-1.5",
  metricLabel: "text-[9px] font-semibold uppercase text-zinc-600",
  metricValue: "text-[12px] font-semibold text-zinc-900",
  chip: "rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] text-zinc-600",
  chipValue: "font-semibold text-zinc-900",
  scoredLabel: "text-zinc-700",
  scoredWeight: "text-zinc-500",
  scoredContribution: "font-semibold text-zinc-900",
  scoredRing:
    "flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-50",
  scoredScore: "text-lg font-bold text-emerald-700",
  sources: "mt-2 text-[9px] leading-relaxed text-zinc-600",
  emptyState: "space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4",
  badgeAmber:
    "rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800",
  badgeLive:
    "rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800",
  marketTone: "text-[10px] text-zinc-600",
  kicker: "text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 sm:text-xs",
  title: "text-lg font-semibold leading-snug text-zinc-900 sm:text-xl",
  summary: "text-sm leading-relaxed text-zinc-700 sm:text-[15px]",
  priceSection: "rounded-lg border border-zinc-200 bg-zinc-50 p-3",
  priceValue: "text-lg font-semibold text-zinc-900",
  priceChange: "text-xs text-zinc-600",
  chartCaption: "mt-2 text-xs leading-relaxed text-zinc-600",
  platformFooter:
    "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3",
  platformLabel: "text-[10px] font-semibold uppercase tracking-wide text-zinc-600",
  platformValue: "text-sm font-semibold text-zinc-900",
  platformMeta: "text-[10px] text-zinc-600",
  ctaButton:
    "rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800",
  footer: "space-y-1 border-t border-zinc-200 pt-2 text-[10px] leading-relaxed text-zinc-600",
  footerMeta: "text-zinc-600",
  tableHead: "border-b border-zinc-200 text-zinc-600",
  tableRow: "border-b border-zinc-100",
  tableCell: "py-2 pr-3 text-zinc-600",
  tableCellValue: "py-2 pr-3 font-semibold text-zinc-900",
  trustBox: "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center",
  trustLabel: "text-[9px] font-semibold uppercase text-zinc-600",
  trustScore: "text-lg font-bold text-emerald-700",
  confidenceHigh: "text-emerald-800 border-emerald-300 bg-emerald-50",
  confidenceMedium: "text-amber-800 border-amber-300 bg-amber-50",
  confidenceLow: "text-zinc-700 border-zinc-300 bg-zinc-100",
  accentLabel: "mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700",
  loadingShell: "rounded-lg border border-zinc-200 bg-zinc-50 p-4",
  loadingBlock: "rounded bg-zinc-200/80",
  loadingText: "text-center text-[10px] font-medium uppercase tracking-widest text-zinc-600",
  expandHint: "text-xs text-zinc-600",
  error: "text-xs text-red-600",
  emptyChart:
    "flex h-[140px] items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-600",
  identityRow:
    "flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2",
};
