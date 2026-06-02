import { IBM_Plex_Sans } from "next/font/google";

export const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

/** Shared with {@link MetricTile} `panelCell` variant — keep in sync. */
export const metricPanelLabelCls = `${ibmPlexSans.className} block text-pretty max-lg:text-[9px] max-lg:font-semibold max-lg:uppercase max-lg:leading-none max-lg:tracking-[0.07em] max-lg:text-zinc-500 lg:text-[16px] lg:font-normal lg:normal-case lg:leading-[150%] lg:tracking-[0px] lg:text-zinc-400`;

export const metricPanelValueWrapCls =
  "mt-0.5 flex w-full min-w-0 flex-wrap items-baseline gap-x-1 lg:mt-3 lg:min-h-[1.75rem]";

export const metricPanelValueCls = `${ibmPlexSans.className} min-w-0 max-w-full tabular-nums tracking-tight max-lg:text-[13px] max-lg:font-bold max-lg:leading-none max-lg:tracking-tight max-lg:tabular-nums lg:text-[clamp(0.9375rem,1.65vw,1.25rem)] lg:font-semibold lg:leading-[150%] lg:tracking-[0px] lg:tabular-nums lg:text-white`;

export const metricPanelInsetCls = "max-lg:px-2 max-lg:py-1.5 lg:px-3.5 lg:py-2.5";

/** Unified row: PSA pop spans two columns on desktop and full width on mobile. */
export const metricPanelPopCellCls = "max-lg:col-span-2 lg:col-span-2";
