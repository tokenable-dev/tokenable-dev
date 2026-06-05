"use client";

import type { ReactNode } from "react";
import {
  COLLECTION_DETAILS_BG_CLASS,
  COLLECTION_DETAILS_BORDER_ALL,
} from "@/components/marketplace/collectionOverviewChrome";
import {
  metricPanelInsetCls,
  metricPanelLabelCls,
  metricPanelValueCls,
  metricPanelValueWrapCls,
} from "./theme";

function isNonemptyFooter(node: ReactNode): boolean {
  if (node === undefined || node === null || node === false) return false;
  if (typeof node === "string") return node.trim().length > 0;
  return true;
}

export function MetricTile({
  label,
  labelTitle,
  value,
  footer,
  compact,
  variant = "card",
  tone = "default",
  labelValueLayout = "stacked",
  cellClassName,
}: {
  label: string;
  /** Full label when {@link label} is abbreviated (narrow desktop). */
  labelTitle?: string;
  value: ReactNode;
  footer?: ReactNode;
  compact: boolean;
  variant?: "card" | "panelCell";
  tone?: "default" | "primary";
  /** `stackedNowrap`: label row + value row, each kept on a single line. */
  labelValueLayout?: "stacked" | "stackedNowrap";
  cellClassName?: string;
}) {
  const border = `${COLLECTION_DETAILS_BORDER_ALL} shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`;
  const labelCls =
    "text-[11px] sm:text-[12px] font-semibold uppercase tracking-[0.06em] text-zinc-400";
  const valueCls = compact
    ? "text-[1.28rem] sm:text-[1.5rem] font-bold tabular-nums tracking-tight leading-none"
    : "text-[1.18rem] sm:text-[1.38rem] font-bold tabular-nums tracking-tight leading-none";

  const hasFooter = isNonemptyFooter(footer);

  if (variant === "panelCell") {
    const inset =
      tone === "primary"
        ? `max-lg:col-span-2 max-lg:rounded-sm max-lg:px-2 max-lg:py-1.5 max-lg:bg-mint/[0.05] lg:col-span-auto lg:rounded-none lg:bg-transparent ${metricPanelInsetCls}`
        : metricPanelInsetCls;
    const nowrap = labelValueLayout === "stackedNowrap";
    const valueNode = (
      <div
        className={
          nowrap
            ? "mt-0.5 flex w-full min-w-0 flex-nowrap items-baseline gap-x-1 overflow-hidden lg:mt-2 lg:min-h-[1.5rem] xl:mt-3 xl:min-h-[1.75rem]"
            : metricPanelValueWrapCls
        }
      >
        <div className={metricPanelValueCls}>{value}</div>
      </div>
    );
    const labelNode = (
      <span className={metricPanelLabelCls} title={labelTitle ?? label}>
        {label}
      </span>
    );
    if (!hasFooter) {
      return (
        <div
          className={`flex w-full min-w-0 flex-col items-start justify-center overflow-hidden text-left ${inset} ${cellClassName ?? ""}`}
        >
          {labelNode}
          {valueNode}
        </div>
      );
    }
    return (
      <div
        className={`flex w-full min-w-0 flex-col items-start justify-center overflow-hidden text-left ${inset} ${cellClassName ?? ""}`}
      >
        {labelNode}
        {valueNode}
        <div className="mt-1 w-full min-w-0 truncate text-left text-[9px] leading-snug text-zinc-500 lg:mt-1.5 lg:text-[clamp(8px,2cqw,11px)]">
          {footer}
        </div>
      </div>
    );
  }

  if (!hasFooter) {
    const pad = compact ? "px-3 py-2.5 sm:px-3.5 sm:py-2.5" : "px-3 py-2.5 sm:px-4 sm:py-3";
    return (
      <div
        className={`flex min-h-0 min-w-0 flex-col justify-center rounded-xl ${COLLECTION_DETAILS_BG_CLASS} ${border} ${pad}`}
      >
        <span className={`${labelCls} leading-[1.3] text-pretty`}>{label}</span>
        <div className={`mt-1.5 flex min-h-[1.5rem] flex-wrap items-baseline gap-x-1 ${valueCls}`}>
          {value}
        </div>
      </div>
    );
  }

  const pad = compact ? "px-3 py-3 sm:px-3.5 sm:py-3" : "px-3 py-3 sm:px-4";

  return (
    <div
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl ${COLLECTION_DETAILS_BG_CLASS} ${border} ${pad}`}
    >
      <div className="flex min-h-[2.8125rem] flex-col justify-end">
        <span className={`${labelCls} leading-[1.35] text-pretty`}>{label}</span>
        <div className={`mt-2 flex min-h-[1.75rem] flex-wrap items-baseline gap-x-1 ${valueCls}`}>
          {value}
        </div>
      </div>
      <div className="mt-2 flex min-h-[2.5rem] flex-col justify-start text-[10px] leading-snug text-zinc-500 sm:min-h-[2.625rem] sm:text-[11px]">
        {footer}
      </div>
    </div>
  );
}
