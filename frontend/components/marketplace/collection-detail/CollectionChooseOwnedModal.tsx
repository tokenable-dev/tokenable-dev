"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TkButton } from "@/components/ds";
import type { CollectionOwnedRwaRow } from "@/hooks/collection-detail/useCollectionOwnedRwa";

/**
 * Pick which owned copy to list — Card.html sell → List for sale.
 */
export function CollectionChooseOwnedModal({
  open,
  onClose,
  collectionTitle,
  rows,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  collectionTitle: string;
  rows: CollectionOwnedRwaRow[];
  onConfirm: (tokenId: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(rows[0]?.tokenId ?? null);
  }, [open, rows]);

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

  if (!open || rows.length === 0 || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="cd-choose-copy"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="cd-choose-copy__sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Select your card to list"
      >
        <div className="cd-choose-copy__grab" aria-hidden />
        <div className="cd-choose-copy__head">
          <div className="cd-choose-copy__head-title">
            <h2 className="cd-choose-copy__title">Select your card</h2>
          </div>
          <button
            type="button"
            className="cd-choose-copy__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="cd-choose-copy__fixed">
          <div className="cd-choose-copy__item">
            <div className="cd-choose-copy__item-title">{collectionTitle}</div>
            <div className="cd-choose-copy__item-sub tkl-mono">
              {rows.length} unlisted
            </div>
          </div>
        </div>
        <div className="cd-choose-copy__scroll">
          {rows.map((row) => {
            const on = selected === row.tokenId;
            return (
              <div
                key={row.tokenId}
                className={`cd-choose-copy__row${on ? " cd-choose-copy__row--sel" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(row.tokenId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(row.tokenId);
                  }
                }}
              >
                {row.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="cd-choose-copy__thumb" src={row.imageUrl} alt="" />
                ) : (
                  <span className="cd-choose-copy__thumb cd-choose-copy__thumb--empty" />
                )}
                <span className="cd-choose-copy__row-body">
                  <span className="cd-choose-copy__cert tkl-mono">{row.certLabel}</span>
                  <span className="cd-choose-copy__vault tkl-mono">{row.vaultLabel}</span>
                </span>
                <span className="cd-choose-copy__radio" aria-hidden>
                  {on ? <span className="cd-choose-copy__radio-dot" /> : null}
                </span>
              </div>
            );
          })}
        </div>
        <div className="cd-choose-copy__foot">
          <TkButton
            type="button"
            variant="primary"
            size="sm"
            className="cd-choose-copy__cta"
            disabled={selected == null}
            onClick={() => {
              if (selected == null) return;
              onClose();
              onConfirm(selected);
            }}
          >
            Continue
          </TkButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
