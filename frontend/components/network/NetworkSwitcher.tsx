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

/** Compact labels for the network picker (header + mobile drawer). */
function networkPickerLabel(chainId: SupportedChainId): string {
  switch (chainId) {
    case 11155111:
      return "Sepolia";
    case 1:
      return "ETH Mainnet";
    case 137:
      return "Polygon";
    default:
      return getChainDefinition(chainId).shortLabel;
  }
}

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
    const onDoc = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  const internalDev = canUseAppChainSwitcher(user);
  if (!isPrivyEnabled() || !internalDev) return null;

  const displayChains = internalDev
    ? SUPPORTED_CHAIN_IDS.map(getChainDefinition)
    : configuredChains;

  const currentLabel = networkPickerLabel(chainId);

  if (displayChains.length <= 1 && !IS_DEV) {
    return (
      <div
        className={`gnb-network-chip${inDrawer ? " gnb-network-chip--drawer" : ""}`}
        title={currentLabel}
      >
        <ChainDot chainId={chainId} />
        <span>{currentLabel}</span>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={inDrawer ? "relative w-full" : "relative"}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`gnb-network-chip${inDrawer ? " gnb-network-chip--drawer" : ""}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Network: ${currentLabel}`}
      >
        <ChainDot chainId={chainId} />
        <span className="truncate">{currentLabel}</span>
        <span className={`text-[10px] opacity-70 transition ${open ? "rotate-180" : ""}`} aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Select network"
          className={`gnb-network-chip__menu${inDrawer ? " gnb-network-chip__menu--drawer" : ""}`}
        >
          <ul className="py-1">
            {displayChains.map((c) => {
              const active = c.id === chainId;
              const configured = isChainConfigured(c.id);
              const label = networkPickerLabel(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    disabled={!configured}
                    title={configured ? label : `${label} (not configured)`}
                    onClick={() => {
                      if (!configured) return;
                      setChainId(c.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "bg-[rgba(0, 51, 255,0.12)] font-semibold text-white"
                        : configured
                          ? "text-[var(--t2)] hover:bg-white/[0.04]"
                          : "cursor-not-allowed text-[var(--t3)] opacity-45"
                    }`}
                  >
                    <ChainDot chainId={c.id} />
                    <span className="flex-1 truncate">{label}</span>
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
