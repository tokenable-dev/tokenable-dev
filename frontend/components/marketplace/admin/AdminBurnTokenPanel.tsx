"use client";

import { useState } from "react";
import {
  ADMIN_BTN_SECONDARY,
  ADMIN_INPUT_MONO,
  ADMIN_LABEL,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";

export function AdminBurnTokenPanel({
  burningTokenId,
  onBurn,
  walletConnected,
  connectPending,
  onConnect,
}: {
  burningTokenId: number | null;
  onBurn: (tokenId: number) => void;
  walletConnected: boolean;
  connectPending: boolean;
  onConnect: () => void;
}) {
  const [tokenIdInput, setTokenIdInput] = useState("");
  const parsed = Number(tokenIdInput.trim());
  const valid = Number.isFinite(parsed) && parsed > 0;

  return (
    <section className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 sm:mb-8 sm:p-5">
      <h2 className="text-sm font-semibold text-red-800 sm:text-base">
        Burn token (test)
      </h2>
      <p className={`mt-2 text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
        Transfers an RWA you own to the test burn address. Cancel any active listing
        first. Not reversible.
      </p>
      {!walletConnected ? (
        <button
          type="button"
          disabled={connectPending}
          onClick={onConnect}
          className={`${ADMIN_BTN_SECONDARY} mt-4`}
        >
          {connectPending ? "Connecting…" : "Connect wallet to burn"}
        </button>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className={ADMIN_LABEL}>Token ID</span>
            <input
              type="text"
              inputMode="numeric"
              value={tokenIdInput}
              onChange={(e) => setTokenIdInput(e.target.value)}
              placeholder="e.g. 42"
              className={`${ADMIN_INPUT_MONO} w-full max-w-[9rem] sm:w-36`}
            />
          </label>
          <button
            type="button"
            disabled={!valid || burningTokenId != null}
            onClick={() => onBurn(parsed)}
            className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
          >
            {burningTokenId === parsed ? "Burning…" : "Burn token"}
          </button>
        </div>
      )}
    </section>
  );
}
