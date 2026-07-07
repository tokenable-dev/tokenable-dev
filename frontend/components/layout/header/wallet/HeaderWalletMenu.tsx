"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useClientMounted } from "@/hooks/ui/useClientMounted";
import { useHeaderWalletMenuData } from "@/hooks/auth/useHeaderWalletMenuData";
import { HeaderWalletMenuPanel } from "./HeaderWalletMenuPanel";
import { WalletChevronIcon } from "./HeaderWalletMenuIcons";

/** Desktop GNB wallet chip + dropdown (HTML tk-wallet-wrap). */
export function HeaderWalletMenu() {
  const mounted = useClientMounted();
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { displayAddress, balanceLabel } = useHeaderWalletMenuData();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onOutsideClick = (event: MouseEvent) => {
      const root = wrapRef.current;
      if (!root?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("click", onOutsideClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onOutsideClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  if (!mounted) {
    return <div className="gnb-auth-skeleton animate-pulse" aria-hidden />;
  }

  return (
    <div className="tk-wallet-wrap" ref={wrapRef}>
      <button
        type="button"
        className="tk-wallet-chip"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="tk-wallet-chip__avatar" aria-hidden />
        <span className="tk-wallet-chip__addr mono">{displayAddress}</span>
        <span className="tk-wallet-chip__bal mono">{balanceLabel}</span>
        <WalletChevronIcon className="tk-wallet-chip__chevron" aria-hidden />
      </button>

      <div
        id={menuId}
        role="menu"
        className="tk-wallet-dropdown"
        data-open={open ? "1" : undefined}
      >
        <HeaderWalletMenuPanel variant="dropdown" onNavigate={close} />
      </div>
    </div>
  );
}
