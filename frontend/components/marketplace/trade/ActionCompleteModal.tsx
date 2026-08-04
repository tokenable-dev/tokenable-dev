"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { TkButton } from "@/components/ds";
import { useClientMounted } from "@/hooks/ui/useClientMounted";
import { cn } from "@/lib/ds/cn";

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
  notch?: boolean;
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
        notch: true,
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
        notch: true,
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

function CheckIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** Shared complete content — overlay or embedded in a sheet (Card.html #tkb-done). */
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
  const toneClass =
    cfg.tone === "neg"
      ? "tk-ac-icon--neg"
      : cfg.tone === "info"
        ? "tk-ac-icon--info"
        : "tk-ac-icon--pos";
  const statusOn = showStatus ?? Boolean(cfg.statusLabel && embedded);
  const hasSecondary = Boolean(secondaryLabel && (secondaryHref || onSecondary));

  return (
    <div
      className={cn("tk-ac-panel", embedded && "tk-ac-panel--embedded", className)}
    >
      <div
        className={cn(
          "tk-ac-icon",
          toneClass,
          cfg.notch && "tk-ac-icon--notch",
          cfg.tone !== "neg" && "tk-ac-icon--draw",
        )}
        aria-hidden
      >
        {cfg.tone === "neg" ? <XIcon /> : <CheckIcon />}
      </div>
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
              className="flex-1 justify-center"
              href={secondaryHref}
              onClick={onSecondary}
            >
              {secondaryLabel}
            </TkButton>
          ) : hasSecondary ? (
            <TkButton
              type="button"
              variant="primary"
              className="flex-1 justify-center"
              onClick={onSecondary}
            >
              {secondaryLabel}
            </TkButton>
          ) : null}
          {onPrimary ? (
            <TkButton
              type="button"
              variant={hasSecondary ? "subtle" : "primary"}
              className="flex-1 justify-center"
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

/** Full-screen complete modal — portfolio-modals.js `pfSaleResult`. */
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
  const mounted = useClientMounted();
  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="tk-ac-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tk-ac-title"
    >
      <button
        type="button"
        className="tk-ac-overlay__scrim"
        aria-label="Close"
        onClick={onClose}
      />
      <ActionCompletePanel
        kind={kind}
        priceUsdc={priceUsdc}
        title={title}
        sub={sub}
        extra={extra}
        primaryLabel={primaryLabel}
        secondaryLabel={secondaryLabel}
        secondaryHref={secondaryHref}
        onPrimary={onPrimary ?? onClose}
        onSecondary={onSecondary}
      />
    </div>,
    document.body,
  );
}
