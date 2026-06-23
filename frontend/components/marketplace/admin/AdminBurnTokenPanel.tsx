"use client";

import { useState } from "react";

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
    <section className="mb-5 rounded-xl border border-red-900/40 bg-red-950/10 p-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-red-300/90">
        Burn token (test)
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
        Transfers an RWA you own to the test burn address. Cancel any active listing
        first. Not reversible.
      </p>
      {!walletConnected ? (
        <button
          type="button"
          disabled={connectPending}
          onClick={onConnect}
          className="mt-3 rounded-lg border border-zinc-700 px-3 py-2 text-[11px] font-semibold text-zinc-300 hover:bg-zinc-800/80 disabled:opacity-50"
        >
          {connectPending ? "Connecting…" : "Connect wallet to burn"}
        </button>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={tokenIdInput}
            onChange={(e) => setTokenIdInput(e.target.value)}
            placeholder="Token ID"
            className="w-28 rounded-lg border border-zinc-700 bg-zinc-950/80 px-2.5 py-2 font-mono text-sm text-white outline-none focus:border-red-500/50"
          />
          <button
            type="button"
            disabled={!valid || burningTokenId != null}
            onClick={() => onBurn(parsed)}
            className="rounded-lg border border-red-600/70 bg-red-950/40 px-3 py-2 text-[11px] font-bold text-red-300 hover:bg-red-900/50 disabled:opacity-40"
          >
            {burningTokenId === parsed ? "Burning…" : "Burn token"}
          </button>
        </div>
      )}
    </section>
  );
}
