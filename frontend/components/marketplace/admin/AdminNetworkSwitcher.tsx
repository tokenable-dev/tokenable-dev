"use client";

import { useEffect, useRef, useState } from "react";
import {
  SUPPORTED_CHAIN_IDS,
  getChainDefinition,
  isChainConfigured,
  type SupportedChainId,
} from "@/lib/chains";
import { useAppChain } from "@/providers/AppChainProvider";
import { ADMIN_BTN_SECONDARY } from "./adminUi";

function ChainDot({ chainId }: { chainId: SupportedChainId }) {
  const color =
    chainId === 1
      ? "bg-blue-500"
      : chainId === 137
        ? "bg-violet-500"
        : "bg-fuchsia-500";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />;
}

/**
 * Admin-console network picker. Always available for authenticated operators —
 * custody / cards / contract roles are per-chain and must not be locked to Sepolia.
 */
export function AdminNetworkSwitcher() {
  const { chain, setChainId, chainId } = useAppChain();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const chains = SUPPORTED_CHAIN_IDS.map(getChainDefinition);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${ADMIN_BTN_SECONDARY} gap-2 px-3 py-1.5`}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={`Active network: ${chain.label}`}
      >
        <ChainDot chainId={chainId} />
        <span className="max-w-[7rem] truncate">{chain.shortLabel}</span>
        <span
          className={`text-[10px] text-zinc-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Select admin network"
          className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg"
        >
          <p className="border-b border-zinc-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Network · assets &amp; custody
          </p>
          <ul className="py-1">
            {chains.map((c) => {
              const active = c.id === chainId;
              const configured = isChainConfigured(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={!configured}
                    title={
                      configured
                        ? undefined
                        : `Not configured — bake NEXT_PUBLIC_CHAIN_${c.id}_* and set backend CHAIN_${c.id}_*`
                    }
                    onClick={() => {
                      if (!configured) return;
                      setChainId(c.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-[var(--brand-500)]/10 text-zinc-900"
                        : configured
                          ? "text-zinc-700 hover:bg-zinc-50"
                          : "cursor-not-allowed text-zinc-400"
                    }`}
                  >
                    <ChainDot chainId={c.id} />
                    <span className="flex-1">
                      <span className="block font-medium">{c.label}</span>
                      <span className="text-[11px] text-zinc-500">
                        {configured
                          ? `${c.nativeSymbol} · chain ${c.id}`
                          : `Not configured · chain ${c.id}`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
