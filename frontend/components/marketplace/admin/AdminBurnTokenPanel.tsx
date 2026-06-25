"use client";

import { useState } from "react";
import {
  ADMIN_BTN_SECONDARY,
  ADMIN_LABEL,
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
    <section className="mb-8 rounded-2xl border border-red-900/40 bg-red-950/10 p-5 sm:p-6">
      <h2 className="text-sm font-bold uppercase tracking-wider text-red-300/90 sm:text-base">
        Burn token (test)
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
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
              className="w-36 rounded-xl border border-zinc-700 bg-zinc-950/80 px-4 py-3 font-mono text-base text-white outline-none focus:border-red-500/50"
            />
          </label>
          <button
            type="button"
            disabled={!valid || burningTokenId != null}
            onClick={() => onBurn(parsed)}
            className="rounded-xl border border-red-600/70 bg-red-950/40 px-5 py-3 text-sm font-bold text-red-300 hover:bg-red-900/50 disabled:opacity-40"
          >
            {burningTokenId === parsed ? "Burning…" : "Burn token"}
          </button>
        </div>
      )}
    </section>
  );
}
