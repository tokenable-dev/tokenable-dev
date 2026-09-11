"use client";

import { useState } from "react";
import {
  ADMIN_BTN_DANGER,
  ADMIN_INPUT_MONO,
  ADMIN_LABEL,
  ADMIN_PANEL_DANGER,
  ADMIN_TEXT_SECONDARY,
  ADMIN_TITLE_DANGER,
} from "./adminUi";

export function AdminBurnTokenPanel({
  burningTokenId,
  onBurn,
}: {
  burningTokenId: number | null;
  onBurn: (tokenId: number) => void;
}) {
  const [tokenIdInput, setTokenIdInput] = useState("");
  const parsed = Number(tokenIdInput.trim());
  const valid = Number.isFinite(parsed) && parsed > 0;

  return (
    <section className={ADMIN_PANEL_DANGER}>
      <h2 className={ADMIN_TITLE_DANGER}>
        Burn by token ID
      </h2>
      <p className={`mt-2 text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
        Executes on-chain <code className="text-xs">adminBurn</code> via the
        platform owner wallet. Active listings are cancelled automatically before
        burn. Not reversible.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className={ADMIN_LABEL}>Token ID</span>
          <input
            type="text"
            inputMode="numeric"
            value={tokenIdInput}
            onChange={(e) => setTokenIdInput(e.target.value)}
            placeholder="e.g. 3"
            className={`${ADMIN_INPUT_MONO} w-full max-w-[9rem] sm:w-36`}
          />
        </label>
        <button
          type="button"
          disabled={!valid || burningTokenId != null}
          onClick={() => onBurn(parsed)}
          className={ADMIN_BTN_DANGER}
        >
          {burningTokenId === parsed ? "Burning…" : "Burn token"}
        </button>
      </div>
    </section>
  );
}
