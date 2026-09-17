"use client";

import { useState } from "react";
import { TkButton, TkDialog } from "@/components/ds";
import { ASSETS } from "@/constants/assets";
import { KBW_MYSTERY_CARD_NAME } from "@/lib/portfolio/kbwMysteryCard";
import "@/styles/tokenable-kbw-mystery-burn.css";

export function KbwMysteryCardBurnModal({
  open,
  onClose,
  onBurn,
}: {
  open: boolean;
  onClose: () => void;
  onBurn: () => Promise<void>;
}) {
  const [burning, setBurning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBurn() {
    setBurning(true);
    setError(null);
    try {
      await onBurn();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Burn failed");
    } finally {
      setBurning(false);
    }
  }

  return (
    <TkDialog
      open={open}
      onClose={() => {
        if (!burning) onClose();
      }}
      title={KBW_MYSTERY_CARD_NAME}
      className="tk-kbw-burn"
      footer={
        <div className="tk-kbw-burn__foot">
          {error ? <p className="tk-kbw-burn__error">{error}</p> : null}
          <TkButton
            type="button"
            variant="danger"
            className="w-full justify-center"
            disabled={burning}
            onClick={() => void handleBurn()}
          >
            {burning ? "Burning…" : "Burn"}
          </TkButton>
        </div>
      }
    >
      <div className="tk-kbw-burn__art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ASSETS.event.kbwMysteryCard}
          alt={KBW_MYSTERY_CARD_NAME}
          width={163}
          height={253}
        />
      </div>
    </TkDialog>
  );
}
