"use client";

import { useEffect, useRef, useState } from "react";
import { canUseAppChainSwitcher } from "@/lib/auth/accountAccess";
import { isPrivyEnabled } from "@/lib/privy/config";
import { useAppChain } from "@/providers/AppChainProvider";
import { useAuthStore } from "@/store/authStore";
import {
  SUPPORTED_CHAIN_IDS,
  getChainDefinition,
  isChainConfigured,
} from "@/lib/chains";
import type { SupportedChainId } from "@/lib/chains";

const IS_DEV = process.env.NODE_ENV === "development";

const CHAIN_ACCENT: Record<SupportedChainId, string> = {
  137: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  80002: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
};

function ChainDot({ chainId }: { chainId: SupportedChainId }) {
  const color = chainId === 137 ? "bg-violet-400" : "bg-fuchsia-400";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />;
}

/** Header network picker — internal dev only (Amoy · Polygon). */
export function NetworkSwitcher() {
  const user = useAuthStore((s) => s.user);
  const { chain, configuredChains, setChainId, chainId } = useAppChain();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!isPrivyEnabled() || !canUseAppChainSwitcher(user)) return null;

  // In dev mode show all supported chains; in prod show only fully configured ones.
  const displayChains = IS_DEV
    ? SUPPORTED_CHAIN_IDS.map(getChainDefinition)
    : configuredChains;

  if (displayChains.length <= 1 && !IS_DEV) {
    return (
      <div
        className={`hidden items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs sm:flex ${CHAIN_ACCENT[chainId]}`}
        title={chain.label}
      >
        <ChainDot chainId={chainId} />
        <span className="font-medium">{chain.shortLabel}</span>
        {chain.isTestnet ? (
          <span className="rounded bg-black/30 px-1 py-0.5 text-[10px] uppercase tracking-wide opacity-80">
            Testnet
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs transition hover:brightness-110 ${CHAIN_ACCENT[chainId]}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {IS_DEV ? (
          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-400/80" aria-hidden>
            DEV
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-wide opacity-70" aria-hidden>
            Net
          </span>
        )}
        <ChainDot chainId={chainId} />
        <span className="max-w-[5.5rem] truncate font-medium">{chain.shortLabel}</span>
        <span className={`text-[10px] opacity-70 transition ${open ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Select network"
          className="absolute right-0 top-[calc(100%+0.35rem)] z-[140] min-w-[14rem] overflow-hidden rounded-xl border border-gray-800 bg-gray-950/95 shadow-xl backdrop-blur-md"
        >
          <p className="border-b border-gray-800/80 px-3 py-2 text-[10px] uppercase tracking-wide text-gray-500">
            {IS_DEV ? (
              <span>
                Network{" "}
                <span className="ml-1 rounded bg-amber-500/20 px-1 py-0.5 font-bold text-amber-300">
                  DEV
                </span>
              </span>
            ) : (
              "Network"
            )}
          </p>
          <ul className="py-1">
            {displayChains.map((c) => {
              const active = c.id === chainId;
              const configured = isChainConfigured(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setChainId(c.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-indigo-500/10 text-white"
                        : configured
                          ? "text-gray-300 hover:bg-gray-900/80"
                          : "text-gray-500 hover:bg-gray-900/60"
                    }`}
                  >
                    <ChainDot chainId={c.id} />
                    <span className="flex-1">
                      <span className="block font-medium">{c.label}</span>
                      <span className="text-[11px] text-gray-500">
                        {c.nativeSymbol} · chain {c.id}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      {c.isTestnet ? (
                        <span className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400">
                          Testnet
                        </span>
                      ) : (
                        <span className="rounded border border-violet-500/30 px-1.5 py-0.5 text-[10px] text-violet-300">
                          Mainnet
                        </span>
                      )}
                      {IS_DEV && !configured ? (
                        <span
                          className="rounded border border-amber-700/50 bg-amber-900/30 px-1.5 py-0.5 text-[10px] text-amber-400"
                          title={`Set NEXT_PUBLIC_CHAIN_${c.id}_RPC_URL, _RWA, _USDC`}
                        >
                          ⚠ ENV
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {IS_DEV ? (
            <p className="border-t border-gray-800/60 px-3 py-2 text-[10px] text-gray-600">
              ⚠ ENV — contracts not configured. API header is set but on-chain calls will fail.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
