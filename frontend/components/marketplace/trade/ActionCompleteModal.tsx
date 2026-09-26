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
  return Math.round(priceUsdc).toLocaleString("en-US");
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
            ? `$${feeNet} paid to your account.`
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
            ? `You get $${price} when it sells.`
            : "You get paid when it sells."),
      };
    case "price-updated":
      return {
        tone: "info",
        title: "Price updated",
        sub:
          override ??
          (price
            ? `Listed at $${price}.`
            : "Your ask price was updated."),
      };
    case "fill-failed":
      return {
        tone: "neg",
        title: "Bid no longer available",
        sub: override ?? "Your price is unchanged.",
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
