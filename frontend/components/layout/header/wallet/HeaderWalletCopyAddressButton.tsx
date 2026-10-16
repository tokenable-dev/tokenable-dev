"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/ds/cn";
import { WalletCopyAddrIcon, WalletCopyCheckIcon } from "./HeaderWalletMenuIcons";

async function copyText(value: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      /* fall through */
    }
  }
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(ta);
  }
}

/** Design-system `.tk-copy-addr` — copy full wallet address with brief check feedback. */
export function HeaderWalletCopyAddressButton({
  address,
  className,
  size = "md",
}: {
  address: string | null | undefined;
  className?: string;
  size?: "sm" | "md";
}) {
  const full = address?.trim() ?? "";
  const [copied, setCopied] = useState(false);
  const busyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onCopy = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!full || busyRef.current) return;
      busyRef.current = true;
      try {
        await copyText(full);
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setCopied(false);
          busyRef.current = false;
          timerRef.current = null;
        }, 1400);
      } catch {
        busyRef.current = false;
      }
    },
    [full],
  );

  if (!full) return null;

  return (
    <button
      type="button"
      className={cn("tk-copy-addr", size === "sm" && "tk-copy-addr--sm", copied && "is-copied", className)}
      aria-label={copied ? "Address copied" : "Copy address"}
      title={copied ? "Copied" : "Copy address"}
      onClick={(e) => void onCopy(e)}
    >
      {copied ? <WalletCopyCheckIcon aria-hidden /> : <WalletCopyAddrIcon aria-hidden />}
    </button>
  );
}
