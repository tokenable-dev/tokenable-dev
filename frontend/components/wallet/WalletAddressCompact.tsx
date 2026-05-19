"use client";

import { getConnectedWalletLabelParts } from "@/lib/wallet/formatConnectedWalletLabel";

export type WalletAddressCompactVariant = "chip" | "panel";

/**
 * Renders `0xabc...def` with a structural gap so `truncate` / CSS ellipsis never
 * replaces the middle with a single period.
 */
export function WalletAddressCompact({
  address,
  variant = "chip",
}: {
  address: string;
  variant?: WalletAddressCompactVariant;
}) {
  const parts = getConnectedWalletLabelParts(address);
  const headTailClass = variant === "panel" ? "text-white" : "text-gray-300";
  const omissionClass = variant === "panel" ? "text-zinc-400" : "text-zinc-500";

  if (!parts) {
    return (
      <span
        className={`whitespace-nowrap font-mono text-sm ${headTailClass}`}
        title={address.trim()}
      >
        {address.trim()}
      </span>
    );
  }

  return (
    <span
      className="inline-flex min-w-0 max-w-full items-center whitespace-nowrap font-mono text-sm"
      title={parts.full}
    >
      <span className={`shrink-0 ${headTailClass}`}>{parts.head}</span>
      <span
        className={`shrink-0 px-0.5 font-sans text-xs font-normal leading-none tracking-[0.12em] ${omissionClass}`}
        aria-hidden
      >
        ...
      </span>
      <span className={`shrink-0 ${headTailClass}`}>{parts.tail}</span>
    </span>
  );
}
