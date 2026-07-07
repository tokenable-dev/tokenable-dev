"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ASSETS } from "@/constants/assets";
import { canAccessVault } from "@/lib/auth/accountAccess";
import { useAuthStore } from "@/store/authStore";

function shouldHideChrome(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === "/site-access" || pathname.startsWith("/site-access/")) return true;
  if (pathname.startsWith("/marketplace/admin")) return true;
  return false;
}

export function TkFooter() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const showVaultLink = canAccessVault(user);
  if (shouldHideChrome(pathname)) return null;

  return (
    <footer className="tk-footer">
      <div className="tk-footer__inner">
        <div className="tk-footer__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ASSETS.logo.tokenableDs} alt="Tokenable" />
          <span className="tk-footer__copy">Tokenized collectibles markets © 2026</span>
        </div>
        <nav className="tk-footer__nav" aria-label="Footer">
          <Link href="/markets" className="navlink">
            Markets
          </Link>
          {showVaultLink ? (
            <Link href="/vault" className="navlink">
              Vault
            </Link>
          ) : null}
          <span className="navlink" aria-disabled>
            Fees
          </span>
          <span className="navlink" aria-disabled>
            Docs
          </span>
          <span className="navlink" aria-disabled>
            Terms
          </span>
        </nav>
      </div>
    </footer>
  );
}
