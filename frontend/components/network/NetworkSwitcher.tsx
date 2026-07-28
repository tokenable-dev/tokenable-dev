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

function ChainDot({ chainId }: { chainId: SupportedChainId }) {
  const color =
    chainId === 1 ? "bg-blue-400" : chainId === 137 ? "bg-violet-400" : "bg-fuchsia-400";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />;
}

/** Header network picker — internal dev only (Sepolia · Ethereum · Polygon). */
export function NetworkSwitcher({ inDrawer = false }: { inDrawer?: boolean }) {
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

  const internalDev = canUseAppChainSwitcher(user);
  if (!isPrivyEnabled() || !internalDev) return null;

  const displayChains = internalDev
    ? SUPPORTED_CHAIN_IDS.map(getChainDefinition)
    : configuredChains;

  const visibilityClass = inDrawer ? "" : "hidden sm:inline-flex";

  if (displayChains.length <= 1 && !IS_DEV) {
    return (
      <div className={`gnb-network-chip ${visibilityClass}`} title={chain.label}>
        <ChainDot chainId={chainId} />
        <span>{chain.shortLabel}</span>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={inDrawer ? "relative" : "relative hidden sm:block"}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="gnb-network-chip"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {IS_DEV || internalDev ? (
          <span className="text-[10px] font-bold uppercase tracking-wide text-amber-400/90" aria-hidden>
            DEV
          </span>
        ) : null}
        <ChainDot chainId={chainId} />
        <span className="max-w-[5.5rem] truncate">{chain.shortLabel}</span>
        <span className={`text-[10px] opacity-70 transition ${open ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Select network"
          className="gnb-network-chip__menu"
        >
          <p className="border-b border-white/[0.06] px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-[var(--t3)]">
            {IS_DEV || internalDev ? "Network · DEV" : "Network"}
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
                        ? "bg-[rgba(0, 51, 255,0.12)] text-white"
                        : configured
                          ? "text-[var(--t2)] hover:bg-white/[0.04]"
                          : "text-[var(--t3)] hover:bg-white/[0.04]"
                    }`}
                  >
                    <ChainDot chainId={c.id} />
                    <span className="flex-1">
                      <span className="block font-medium">{c.label}</span>
                      <span className="text-[11px] text-[var(--t3)]">
                        {c.nativeSymbol} · chain {c.id}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {IS_DEV || internalDev ? (
            <p className="border-t border-white/[0.06] px-3 py-2 text-[10px] text-[var(--t3)]">
              Polygon/Ethereum need CHAIN_137_* / CHAIN_1_* (+ matching NEXT_PUBLIC_*).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
