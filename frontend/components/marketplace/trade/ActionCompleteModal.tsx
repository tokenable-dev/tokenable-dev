"use client";

import type { ReactNode } from "react";
import { TkButton, TkDialog } from "@/components/ds";
import { cn } from "@/lib/ds/cn";
import "@/styles/tokenable-action-complete.css";

export type ActionCompleteKind =
  | "purchase"
  | "sale"
  | "bid"
  | "listed"
  | "price-updated"
  | "fill-failed"
  | "success";

type Tone = "pos" | "info" | "neg";

type KindConfig = {
  tone: Tone;
  title: string;
  sub: string;
  statusLabel?: string;
  statusValue?: string;
};

function formatUsd(priceUsdc?: number | null): string | null {
  if (priceUsdc == null || !Number.isFinite(priceUsdc) || priceUsdc <= 0) return null;
  return priceUsdc.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function actionCompleteConfig(
  kind: ActionCompleteKind,
  opts?: { priceUsdc?: number | null; sub?: string | null },
): KindConfig {
  const price = formatUsd(opts?.priceUsdc);
  const override = opts?.sub?.trim() || null;

  switch (kind) {
    case "purchase":
      return {
        tone: "pos",
        title: "Purchase complete",
        sub:
          override ??
          "Owned instantly. Your card stays safe in the vault — redeem it anytime.",
        statusLabel: "Status",
        statusValue: "Owned · in vault",
      };
    case "sale": {
      const feeNet =
        opts?.priceUsdc != null && Number.isFinite(opts.priceUsdc)
          ? formatUsd(opts.priceUsdc * 0.95)
          : null;
      return {
        tone: "pos",
        title: price ? `Sold at $${price}` : "Sale complete",
        sub:
          override ??
          (feeNet
            ? `$${feeNet} is on its way to your account.`
            : "Your listing matched — USDC should appear in your wallet shortly."),
      };
    }
    case "bid":
      return {
        tone: "pos",
        title: "Bid submitted",
        sub:
          override ??
          (price
            ? `Your bid of $${price} is live. We'll notify you if it's matched — no funds are held until then.`
            : "Your bid is live. We'll notify you if it's matched — no funds are held until then."),
      };
    case "listed":
      return {
        tone: "pos",
        title: "Listed successfully",
        sub:
          override ??
          (price
            ? `Listed at $${price}. We'll let you know when a bid meets it.`
            : "Your listing is live. We'll let you know when a bid meets it."),
      };
    case "price-updated":
      return {
        tone: "info",
        title: "Price updated",
        sub:
          override ??
          (price
            ? `Listed at $${price}. We'll let you know when a bid meets it.`
            : "Your ask price was updated. We'll let you know when a bid meets it."),
      };
    case "fill-failed":
      return {
        tone: "neg",
        title: "That bid could no longer be filled",
        sub: override ?? "The offer was removed. Your price is unchanged.",
      };
    case "success":
    default:
      return {
        tone: "pos",
        title: "Success",
        sub: override ?? "",
      };
  }
}

/**
 * Shared complete content — Feedback-States Dialog (title / body / Done).
 * Embedded variant for sheets (bid checkout) keeps the same copy hierarchy.
 */
export function ActionCompletePanel({
  kind,
  priceUsdc,
  title,
  sub,
  embedded = false,
  showStatus,
  extra,
  primaryLabel = "Done",
  secondaryLabel,
  secondaryHref,
  onPrimary,
  onSecondary,
  className,
}: {
  kind: ActionCompleteKind;
  priceUsdc?: number | null;
  title?: string;
  sub?: string | null;
  embedded?: boolean;
  showStatus?: boolean;
  extra?: ReactNode;
  primaryLabel?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  className?: string;
}) {
  const cfg = actionCompleteConfig(kind, { priceUsdc, sub });
  const resolvedTitle = title ?? cfg.title;
  const resolvedSub = sub ?? cfg.sub;
  const statusOn = showStatus ?? Boolean(cfg.statusLabel && embedded);
  const hasSecondary = Boolean(secondaryLabel && (secondaryHref || onSecondary));

  return (
    <div
      className={cn(
        "tk-ac-panel",
        embedded && "tk-ac-panel--embedded",
        className,
      )}
    >
      <h2 className="tk-ac-title" id="tk-ac-title">
        {resolvedTitle}
      </h2>
      {resolvedSub ? <p className="tk-ac-sub">{resolvedSub}</p> : null}
      {statusOn && cfg.statusLabel ? (
        <div className="tk-ac-status">
          <span className="tk-ac-status__label">{cfg.statusLabel}</span>
          <span className="tk-ac-status__value">{cfg.statusValue}</span>
        </div>
      ) : null}
      {extra ? <div className="tk-ac-extra">{extra}</div> : null}
      {onPrimary || hasSecondary ? (
        <div
          className={cn("tk-ac-actions", !hasSecondary && "tk-ac-actions--stack")}
        >
          {hasSecondary && secondaryHref ? (
            <TkButton
              variant="primary"
              size="md"
              className="tk-ac-btn"
              href={secondaryHref}
              onClick={onSecondary}
            >
              {secondaryLabel}
            </TkButton>
          ) : hasSecondary ? (
            <TkButton
              type="button"
              variant="primary"
              size="md"
              className="tk-ac-btn"
              onClick={onSecondary}
            >
              {secondaryLabel}
            </TkButton>
          ) : null}
          {onPrimary ? (
            <TkButton
              type="button"
              variant={hasSecondary ? "subtle" : "primary"}
              size="md"
              className="tk-ac-btn"
              onClick={onPrimary}
            >
              {primaryLabel}
            </TkButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Full-screen result modal — Feedback-States.dc.html Dialog pattern via TkDialog. */
export function ActionCompleteModal({
  open,
  kind,
  priceUsdc,
  title,
  sub,
  primaryLabel = "Done",
  secondaryLabel,
  secondaryHref,
  onPrimary,
  onSecondary,
  onClose,
  extra,
}: {
  open: boolean;
  kind: ActionCompleteKind;
  priceUsdc?: number | null;
  title?: string;
  sub?: string | null;
  primaryLabel?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onClose: () => void;
  extra?: ReactNode;
}) {
  const cfg = actionCompleteConfig(kind, { priceUsdc, sub });
  const resolvedTitle = title ?? cfg.title;
  const resolvedSub = (sub ?? cfg.sub) || undefined;
  const hasSecondary = Boolean(secondaryLabel && (secondaryHref || onSecondary));

  return (
    <TkDialog
      open={open}
      onClose={onClose}
      title={resolvedTitle}
      description={resolvedSub}
      className="tk-ac-dialog"
      footer={
        <div className={cn("tk-ac-actions", !hasSecondary && "tk-ac-actions--stack")}>
          {hasSecondary && secondaryHref ? (
            <TkButton
              variant="primary"
              size="md"
              className="tk-ac-btn"
              href={secondaryHref}
              onClick={onSecondary}
            >
              {secondaryLabel}
            </TkButton>
          ) : hasSecondary ? (
            <TkButton
              type="button"
              variant="primary"
              size="md"
              className="tk-ac-btn"
              onClick={onSecondary}
            >
              {secondaryLabel}
            </TkButton>
          ) : null}
          <TkButton
            type="button"
            variant={hasSecondary ? "subtle" : "primary"}
            size="md"
            className="tk-ac-btn"
            onClick={onPrimary ?? onClose}
          >
            {primaryLabel}
          </TkButton>
        </div>
      }
    >
      {extra}
    </TkDialog>
  );
}
