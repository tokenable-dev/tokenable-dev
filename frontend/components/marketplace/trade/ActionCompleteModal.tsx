"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TkButton } from "@/components/ds";
import { useClientMounted } from "@/hooks/ui/useClientMounted";
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
        title: price ? `Listed at $${price}` : "Listed successfully",
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

function ResultIcon({ tone }: { tone: Tone }) {
  const stroke = tone === "neg" ? "#e4374a" : tone === "info" ? "#1a6fff" : "#00c864";
  if (tone === "neg") {
    return (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );
  }
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Center result overlay — Portfolio.html `pfSaleResult` (portfolio-modals.js). */
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
  const cfg = actionCompleteConfig(kind, { priceUsdc, sub });
  const resolvedTitle = title ?? cfg.title;
  const resolvedSub = (sub ?? cfg.sub) || undefined;
  const hasSecondary = Boolean(secondaryLabel && (secondaryHref || onSecondary));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="tk-sale-result-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tk-sale-result-title"
        className="tk-sale-result"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`tk-sale-result__icon tk-sale-result__icon--${cfg.tone}`}>
          <ResultIcon tone={cfg.tone} />
        </div>
        <h2 className="tk-sale-result__title" id="tk-sale-result-title">
          {resolvedTitle}
        </h2>
        {resolvedSub ? <p className="tk-sale-result__sub">{resolvedSub}</p> : null}
        {extra ? <div className="tk-sale-result__extra">{extra}</div> : null}
        {cfg.statusLabel && cfg.statusValue ? (
          <div className="tk-sale-result__status">
            <span className="tk-sale-result__status-label">{cfg.statusLabel}</span>
            <span className="tk-sale-result__status-value">{cfg.statusValue}</span>
          </div>
        ) : null}
        <div className="tk-sale-result__actions">
          {hasSecondary && secondaryHref ? (
            <TkButton
              variant="primary"
              size="md"
              href={secondaryHref}
              onClick={onSecondary}
            >
              {secondaryLabel}
            </TkButton>
          ) : hasSecondary ? (
            <TkButton type="button" variant="primary" size="md" onClick={onSecondary}>
              {secondaryLabel}
            </TkButton>
          ) : null}
          <TkButton
            type="button"
            variant={hasSecondary ? "subtle" : "primary"}
            size="md"
            onClick={onPrimary ?? onClose}
          >
            {primaryLabel}
          </TkButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
