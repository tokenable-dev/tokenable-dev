/** Shared layout + typography for marketplace admin (backoffice style). */

export const ADMIN_SHELL_BG = "bg-zinc-100 text-zinc-900";

/** Readable text on white / zinc-50 cards (WCAG-friendly on light UI). */
export const ADMIN_TEXT_BODY = "text-zinc-800";
export const ADMIN_TEXT_SECONDARY = "text-zinc-700";
export const ADMIN_TEXT_MUTED = "text-zinc-600";
export const ADMIN_TEXT_META = "text-zinc-600";
export const ADMIN_TEXT_EMPTY = "text-zinc-600";
export const ADMIN_TEXT_ERROR = "text-sm text-red-600";
export const ADMIN_TEXT_BRAND = "font-semibold text-[var(--brand-600)]";

export const ADMIN_PAGE_TITLE =
  "text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl";

export const ADMIN_PAGE_SUBTITLE =
  `mt-1 max-w-3xl text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`;

export const ADMIN_LIST = "space-y-4 sm:space-y-5";

export const ADMIN_COUNT = `text-sm font-medium ${ADMIN_TEXT_SECONDARY}`;

export const ADMIN_ARTICLE =
  "rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5";

export const ADMIN_PANEL =
  "rounded-lg border border-zinc-200 bg-white shadow-sm";

export const ADMIN_STAT_CARD =
  "rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-3";

/** Wrap dark-themed market widgets (Top 100, Top Movers) inside light admin pages. */
export const ADMIN_EMBEDDED_DARK =
  "overflow-hidden rounded-lg border border-zinc-300 bg-zinc-950 p-4 text-white shadow-sm sm:p-6";

export const ADMIN_LABEL =
  `mb-1.5 block text-xs font-medium ${ADMIN_TEXT_SECONDARY}`;

export const ADMIN_INPUT =
  "w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-500 focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-500)]/20 sm:text-sm";

export const ADMIN_INPUT_MONO = `${ADMIN_INPUT} font-mono sm:text-[13px]`;

export const ADMIN_INPUT_DANGER =
  `${ADMIN_INPUT_MONO} border-red-900/60 focus:border-red-500/60`;

export const ADMIN_BTN_PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--brand-500)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand-600)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-2";

export const ADMIN_BTN_SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-2";

export const ADMIN_BTN_GHOST =
  `inline-flex min-h-11 items-center justify-center rounded-md px-3 py-2.5 text-sm font-medium ${ADMIN_TEXT_SECONDARY} transition-colors hover:bg-zinc-100 hover:text-zinc-900 sm:min-h-0 sm:py-2`;

export const ADMIN_BTN_LOAD_MORE =
  "w-full rounded-md border border-zinc-300 bg-white py-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50";

export const ADMIN_BTN_DANGER =
  "inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40";

export const ADMIN_BTN_DANGER_EMPHASIS =
  "inline-flex items-center justify-center rounded-xl border border-red-600/70 bg-red-950/40 px-4 py-2.5 text-sm font-bold text-red-300 transition-colors hover:bg-red-900/50 disabled:cursor-not-allowed disabled:opacity-40";

export const ADMIN_BTN_DANGER_EMPHASIS_ALT =
  "inline-flex w-full items-center justify-center rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50";

export const ADMIN_DETAILS_SUMMARY =
  `cursor-pointer select-none text-xs font-medium ${ADMIN_TEXT_SECONDARY} sm:text-sm`;

export const ADMIN_DETAILS_DANGER_SUMMARY = `${ADMIN_DETAILS_SUMMARY} text-red-600`;

export const ADMIN_LINK =
  "font-medium text-[var(--brand-500)] hover:text-[var(--brand-600)] hover:underline";

export const ADMIN_LINK_SM =
  "text-sm font-medium text-[var(--brand-500)] hover:text-[var(--brand-600)] hover:underline";

export const ADMIN_PANEL_DANGER =
  "mb-6 rounded-lg border border-red-200 bg-red-50 p-4 sm:mb-8 sm:p-5";

export const ADMIN_TITLE_DANGER = "text-sm font-semibold text-red-800 sm:text-base";

export const ADMIN_PANEL_DANGER_DARK =
  "rounded-xl border border-red-900/40 bg-red-950/10 p-4 sm:p-5";

export const ADMIN_PANEL_DANGER_DARK_COMPACT =
  "rounded-xl border border-red-900/40 bg-red-950/20 p-3";

export const ADMIN_PROGRESS_TRACK = "h-2 overflow-hidden rounded-full bg-zinc-200";

export const ADMIN_PROGRESS_FILL =
  "h-full rounded-full bg-[var(--brand-500)] transition-all";

export const ADMIN_CHART_BAR = "bg-[var(--brand-500)]";

export const ADMIN_COVER_BOX =
  "flex h-32 w-full shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 sm:h-36 sm:w-36";

export const ADMIN_COVER_BOX_CARD =
  "flex h-36 w-full shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-50 sm:h-40 sm:w-40";

export const ADMIN_TABLE_WRAP =
  "overflow-x-auto rounded-lg border border-zinc-200 bg-white";

export const ADMIN_TABLE =
  "w-full min-w-[32rem] text-left text-sm";

export const ADMIN_TABLE_HEAD =
  `border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide ${ADMIN_TEXT_MUTED}`;

export const ADMIN_TABLE_TH = "px-3 py-2.5 font-medium first:pl-4 last:pr-4 sm:px-4";

export const ADMIN_TABLE_TD =
  `border-b border-zinc-100 px-3 py-2.5 ${ADMIN_TEXT_BODY} first:pl-4 last:pr-4 sm:px-4`;

export const ADMIN_BADGE =
  "inline-flex rounded-md px-2 py-0.5 text-xs font-medium";

export const ADMIN_TOOLBAR =
  "mb-4 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:p-4";

export const ADMIN_SEGMENT =
  "inline-flex flex-wrap gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-1";

export const ADMIN_SEGMENT_BTN =
  `rounded px-2.5 py-1.5 text-xs font-medium ${ADMIN_TEXT_SECONDARY} transition-colors hover:text-zinc-900 sm:text-sm`;

export const ADMIN_SEGMENT_BTN_ACTIVE =
  "rounded bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200 sm:text-sm";

export const ADMIN_NAV_LINK =
  "flex min-h-11 items-center rounded-md px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-900";

export const ADMIN_NAV_LINK_ACTIVE =
  "flex min-h-11 items-center rounded-md bg-zinc-100 px-3 py-2.5 text-sm font-semibold text-zinc-900 ring-1 ring-zinc-200";
