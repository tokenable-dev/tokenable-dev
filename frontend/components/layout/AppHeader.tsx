"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { formatUnits } from "viem";
import { ASSETS } from "@/constants/assets";
import { sepolia } from "@/config/wagmi";
import type { MarketplaceCollectionSummary } from "@/lib/core";
import { ensureSepoliaNetwork } from "@/lib/network";
import { useMarketplaceCollectionsInfinite } from "@/hooks/useMarketplaceCollectionsInfinite";
import { useResolvedMediaUrlMap } from "@/hooks/useResolvedMediaUrl";
import { useAppStore, selectUsdcBalance } from "@/store";
import { useShallow } from "zustand/react/shallow";

function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const colInfinite = useMarketplaceCollectionsInfinite();
  const collections = useMemo<MarketplaceCollectionSummary[]>(
    () => colInfinite.data?.pages.flatMap((p) => p.items) ?? [],
    [colInfinite.data],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      while (!cancelled && colInfinite.hasNextPage) {
        await colInfinite.fetchNextPage();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, colInfinite.hasNextPage, colInfinite.fetchNextPage]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return collections.filter((c) => {
      const label = c.displayLabel.toLowerCase();
      const key = c.collectionKey.toLowerCase();
      const qUsed = (c.queryUsed ?? "").toLowerCase();
      return label.includes(q) || key.includes(q) || qUsed.includes(q);
    });
  }, [query, collections]);

  useEffect(() => {
    setHighlightIdx(-1);
  }, [query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function navigate(c: MarketplaceCollectionSummary) {
    router.push(`/marketplace/collections/${encodeURIComponent(c.collectionKey)}`);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!filtered.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((p) => (p + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((p) => (p <= 0 ? filtered.length - 1 : p - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < filtered.length) {
        navigate(filtered[highlightIdx]);
      }
    }
  }

  const showDropdown = open && query.trim().length > 0;

  const coverSources = useMemo(
    () => filtered.map((c) => c.coverImageUrl),
    [filtered],
  );
  const { map: coverUrlMap } = useResolvedMediaUrlMap(coverSources, {
    enabled: showDropdown && filtered.length > 0,
  });

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={`flex items-center rounded-xl border bg-gray-800/50 px-3 py-1.5 min-w-[180px] sm:min-w-[260px] transition-colors ${
          open ? "border-mint/40" : "border-gray-700/60 hover:border-gray-600"
        }`}
        onClick={() => { if (!open) setOpen(true); }}
      >
        <svg className="w-3.5 h-3.5 shrink-0 text-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          className="ml-2 flex-1 bg-transparent text-xs text-white placeholder-gray-500 outline-none cursor-text min-w-0"
        />
        {!open && (
          <kbd className="hidden sm:inline-flex ml-auto text-[10px] text-gray-600 border border-gray-700 rounded px-1 py-0.5 font-mono shrink-0">
            ⌘K
          </kbd>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl border border-gray-700/60 bg-gray-900/98 shadow-2xl shadow-black/50 backdrop-blur-lg overflow-hidden z-[70]">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-gray-500">
              No collections found
            </div>
          ) : (
            <ul
              className="max-h-[156px] overflow-y-auto overscroll-contain scrollbar-thin py-1"
              role="listbox"
            >
              {filtered.map((c, i) => (
                <li
                  key={c.collectionKey}
                  role="option"
                  aria-selected={i === highlightIdx}
                  onMouseEnter={() => setHighlightIdx(i)}
                  onClick={() => navigate(c)}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 cursor-pointer transition-colors ${
                    i === highlightIdx
                      ? "bg-mint/10"
                      : "hover:bg-gray-800/60"
                  }`}
                >
                  <div className="w-7 h-7 rounded-md bg-gray-800 border border-gray-700/50 overflow-hidden shrink-0 flex items-center justify-center">
                    {c.coverImageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={
                          coverUrlMap.get(c.coverImageUrl.trim()) ??
                          c.coverImageUrl.trim()
                        }
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white truncate">
                      {c.displayLabel}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {c.activeListingCount} listing{c.activeListingCount !== 1 ? "s" : ""}
                      {c.queryUsed ? ` · ${c.queryUsed}` : ""}
                    </p>
                  </div>
                  <svg className="w-3 h-3 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const DROPDOWN_ITEMS = [
  { label: "My Assets", href: "/portfolio", icon: "wallet" as const, available: true },
  { label: "Transaction History", href: "#", icon: "history" as const, available: false },
  { label: "Watchlist", href: "#", icon: "star" as const, available: false },
  { label: "Notifications", href: "#", icon: "bell" as const, available: false },
  { label: "Rewards", href: "#", icon: "gift" as const, available: false },
  { label: "Settings", href: "#", icon: "settings" as const, available: false },
] as const;

type IconName = (typeof DROPDOWN_ITEMS)[number]["icon"];

function DropdownIcon({ name, className }: { name: IconName; className?: string }) {
  const c = className ?? "w-4 h-4";
  switch (name) {
    case "wallet":
      return <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h3.75A2.25 2.25 0 0121 6v6zm0 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V6a2.25 2.25 0 012.25-2.25h13.5" /><circle cx="17.25" cy="12" r="1" fill="currentColor" /></svg>;
    case "history":
      return <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "star":
      return <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>;
    case "bell":
      return <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>;
    case "gift":
      return <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H4.5a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>;
    case "settings":
      return <svg className={c} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
  }
}

function WalletDropdown() {
  const { address, isConnected, chain, connector } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address, chainId: sepolia.id });
  const { usdcBalanceFormatted } = useAppStore(useShallow(selectUsdcBalance));
  const [open, setOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isWrongNetwork = isConnected && chain?.id !== sepolia.id;

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  async function handleSwitchToSepolia() {
    if (!connector) return;
    setIsSwitching(true);
    try {
      const provider = (await connector.getProvider()) as {
        request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      } | null;
      if (provider?.request) {
        await ensureSepoliaNetwork(
          provider as Parameters<typeof ensureSepoliaNetwork>[0],
        );
      }
    } finally {
      setIsSwitching(false);
    }
  }

  if (!isConnected || !address) {
    const metaMaskConnector = connectors.find((c) => c.name === "MetaMask");
    return (
      <button
        onClick={() => metaMaskConnector && connect({ connector: metaMaskConnector })}
        disabled={isPending || !metaMaskConnector}
        className="flex items-center gap-2 rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-[#030712] transition-all hover:brightness-110 hover:shadow-lg hover:shadow-mint/25 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h3.75A2.25 2.25 0 0121 6v6zm0 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V6a2.25 2.25 0 012.25-2.25h13.5" />
        </svg>
        {isPending ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  const ethBal =
    balance
      ? `${parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4)} ETH`
      : "—";
  const usdcBal = parseFloat(usdcBalanceFormatted).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors ${
          open
            ? "border-mint/40 bg-gray-800/90"
            : "border-gray-700/60 bg-gray-800/50 hover:border-gray-600"
        }`}
      >
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${isWrongNetwork ? "bg-red-400" : "bg-mint"}`}
        />
        <span className="font-mono text-gray-300">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-gray-700/60 bg-gray-900/98 shadow-2xl shadow-black/40 backdrop-blur-lg overflow-hidden z-[60]">
          {/* Wallet summary */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-800/60">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-mint/15 border border-mint/25">
                <svg className="w-4 h-4 text-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h3.75A2.25 2.25 0 0121 6v6zm0 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V6a2.25 2.25 0 012.25-2.25h13.5" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </p>
                <p className="text-[11px] text-gray-500">Ethereum Sepolia</p>
              </div>
              {isWrongNetwork && (
                <span className="ml-auto text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full">
                  Wrong Network
                </span>
              )}
            </div>
            {/* Balances */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-gray-800/60 px-3 py-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">ETH</p>
                <p className="text-sm font-medium text-white">{ethBal}</p>
              </div>
              <div className="rounded-lg bg-gray-800/60 px-3 py-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">USDC</p>
                <p className="text-sm font-medium text-white">{usdcBal}</p>
              </div>
            </div>
          </div>

          {/* Wrong network action */}
          {isWrongNetwork && (
            <div className="px-4 py-2 border-b border-gray-800/60">
              <button
                onClick={() => void handleSwitchToSepolia()}
                disabled={isSwitching}
                className="w-full rounded-lg bg-red-500/15 border border-red-500/30 py-2 text-xs font-medium text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
              >
                {isSwitching ? "Switching..." : "Switch to Sepolia"}
              </button>
            </div>
          )}

          {/* Menu items */}
          <div className="py-1">
            {DROPDOWN_ITEMS.map((item) => {
              const inner = (
                <div className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-800/50 group">
                  <DropdownIcon
                    name={item.icon}
                    className={`w-4 h-4 ${item.available ? "text-gray-400 group-hover:text-white" : "text-gray-600"}`}
                  />
                  <span className={item.available ? "text-gray-300 group-hover:text-white" : "text-gray-600"}>
                    {item.label}
                  </span>
                  {!item.available && (
                    <span className="ml-auto text-[10px] text-gray-600 border border-gray-700/60 rounded px-1.5 py-0.5">
                      Soon
                    </span>
                  )}
                </div>
              );
              if (item.available) {
                return (
                  <Link key={item.label} href={item.href} onClick={close}>
                    {inner}
                  </Link>
                );
              }
              return (
                <div key={item.label} className="cursor-default">
                  {inner}
                </div>
              );
            })}
          </div>

          {/* Disconnect */}
          <div className="border-t border-gray-800/60 p-2">
            <button
              onClick={() => {
                disconnect();
                close();
              }}
              className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-3l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Disconnect Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppHeader() {
  return (
    <header className="border-b border-gray-800/60 backdrop-blur-sm sticky top-0 z-50 bg-gray-950/90">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: logo + nav */}
        <div className="flex items-center gap-5 min-w-0">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <img
              src={ASSETS.icons.tokenable}
              alt="Tokenable"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
          </Link>
          <div className="hidden sm:flex items-center gap-4">
            <Link
              href="/markets"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Markets
            </Link>
            <Link
              href="/portfolio"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              My Assets
            </Link>
            <Link
              href="/vault"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Vault
            </Link>
          </div>
        </div>

        {/* Right: search + wallet */}
        <div className="flex items-center gap-3 shrink-0">
          <SearchBar />
          <WalletDropdown />
        </div>
      </div>
    </header>
  );
}
