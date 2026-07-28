"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { formatPortfolioUsd } from "@/lib/portfolio/portfolioTableHelpers";
import { PortfolioCostBasisPencilButton } from "./PortfolioCostBasisPencil";

function formatInputValue(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd)) return "";
  return String(usd);
}

function parseCostInput(raw: string, fallback: number | null | undefined): number | null {
  const val = parseFloat(raw.replace(/[^\d.]/g, ""));
  if (Number.isFinite(val) && val >= 0) return val;
  if (fallback != null && Number.isFinite(fallback) && fallback >= 0) return fallback;
  return null;
}

/** Portfolio.html inline cost basis edit — pencil → input; Enter saves, Escape/blur cancels. */
export function PortfolioCostBasisInlineEdit({
  assetName,
  valueUsd,
  editable,
  saving = false,
  showMintPriceNote = false,
  layout,
  onSave,
}: {
  assetName: string;
  valueUsd: number | null | undefined;
  editable: boolean;
  saving?: boolean;
  showMintPriceNote?: boolean;
  layout: "desktop" | "mobile";
  onSave: (costBasisUsd: number) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurRef = useRef(false);

  const cancel = useCallback(() => {
    setEditing(false);
    setDraft("");
  }, []);

  const commit = useCallback(async () => {
    const parsed = parseCostInput(draft, valueUsd);
    if (parsed == null) {
      cancel();
      return;
    }
    skipBlurRef.current = true;
    try {
      await onSave(parsed);
      setEditing(false);
      setDraft("");
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
    } finally {
      skipBlurRef.current = false;
    }
  }, [cancel, draft, onSave, valueUsd]);

  const startEdit = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editable || saving) return;
    setDraft(formatInputValue(valueUsd));
    setEditing(true);
  };

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      void commit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  const handleBlur = () => {
    if (skipBlurRef.current) return;
    cancel();
  };

  const input = (
    <div className="pf-cost-edit-wrap">
      <span className="pf-cost-edit-prefix" aria-hidden>
        $
      </span>
      <input
        ref={inputRef}
        className="pf-cost-edit-input"
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={saving}
        aria-label={`Edit cost basis for ${assetName}`}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );

  if (layout === "mobile") {
    return (
      <>
        <div className="pf-mobile-asset-card__row">
          <span className="pf-mobile-asset-card__label">
            Cost
            {editable && !editing ? (
              <span className="pf-mobile-asset-card__cost-hint">
                Value at listing
                <PortfolioCostBasisPencilButton
                  label={`Edit cost basis for ${assetName}`}
                  onClick={startEdit}
                />
              </span>
            ) : null}
          </span>
          {editing ? (
            input
          ) : (
            <span className="pf-mobile-asset-card__val tkl-mono">
              {formatPortfolioUsd(valueUsd)}
            </span>
          )}
        </div>
        {editing ? (
          <span className="pf-cost-edit-note pf-cost-edit-note--mobile">Default: minting price</span>
        ) : null}
      </>
    );
  }

  if (editing) {
    return (
      <div className="pf-cost-basis-cell pf-cost-basis-cell--editing">
        <div className="pf-cost-basis-row pf-cost-basis-row--editing">{input}</div>
        <span className="pf-cost-edit-note">Default: minting price</span>
      </div>
    );
  }

  return (
    <div className="pf-cost-basis-cell">
      <div className="pf-cost-basis-row">
        <span className="tkl-mono pf-table-cost">{formatPortfolioUsd(valueUsd)}</span>
        {editable ? (
          <PortfolioCostBasisPencilButton
            label={`Edit cost basis for ${assetName}`}
            onClick={startEdit}
          />
        ) : null}
      </div>
      {showMintPriceNote ? <span className="pf-cost-basis-note">Value at listing</span> : null}
    </div>
  );
}
