/** Shared layout + typography for marketplace admin (backoffice style). */

export const ADMIN_SHELL_BG = "bg-zinc-100 text-zinc-900";

/** Readable text on white / zinc-50 cards (WCAG-friendly on light UI). */
export const ADMIN_TEXT_BODY = "text-zinc-800";
export const ADMIN_TEXT_SECONDARY = "text-zinc-700";
export const ADMIN_TEXT_MUTED = "text-zinc-600";
export const ADMIN_TEXT_META = "text-zinc-600";
export const ADMIN_TEXT_EMPTY = "text-zinc-600";

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

/** Wrap dark-themed market widgets (Top 100, Top Movers) inside light admin pages. */
export const ADMIN_EMBEDDED_DARK =
  "overflow-hidden rounded-lg border border-zinc-300 bg-zinc-950 p-4 text-white shadow-sm sm:p-6";

export const ADMIN_LABEL =
  `mb-1.5 block text-xs font-medium ${ADMIN_TEXT_SECONDARY}`;

export const ADMIN_INPUT =
  "w-full min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-500 focus:border-[#1A6FFF] focus:ring-2 focus:ring-[#1A6FFF]/20 sm:text-sm";

export const ADMIN_INPUT_MONO = `${ADMIN_INPUT} font-mono sm:text-[13px]`;

export const ADMIN_BTN_PRIMARY =
  "inline-flex items-center justify-center rounded-md bg-[#1A6FFF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1558d6] disabled:cursor-not-allowed disabled:opacity-50";

export const ADMIN_BTN_SECONDARY =
  "inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50";

export const ADMIN_BTN_GHOST =
  `inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium ${ADMIN_TEXT_SECONDARY} transition-colors hover:bg-zinc-100 hover:text-zinc-900`;

export const ADMIN_BTN_LOAD_MORE =
  "w-full rounded-md border border-zinc-300 bg-white py-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50";

export const ADMIN_DETAILS_SUMMARY =
  `cursor-pointer select-none text-xs font-medium ${ADMIN_TEXT_SECONDARY} sm:text-sm`;

export const ADMIN_LINK =
  "font-medium text-[#1A6FFF] hover:text-[#1558d6] hover:underline";

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
  "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium";

export const ADMIN_TOOLBAR =
  "mb-4 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:p-4";

export const ADMIN_SEGMENT =
  "inline-flex flex-wrap gap-1 rounded-md border border-zinc-200 bg-zinc-50 p-1";

export const ADMIN_SEGMENT_BTN =
  `rounded px-2.5 py-1.5 text-xs font-medium ${ADMIN_TEXT_SECONDARY} transition-colors hover:text-zinc-900 sm:text-sm`;

export const ADMIN_SEGMENT_BTN_ACTIVE =
  "rounded bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200 sm:text-sm";
