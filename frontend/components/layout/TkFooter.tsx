"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ASSETS } from "@/constants/assets";
import { useHeaderNavGate } from "@/hooks/auth/useHeaderNavGate";

function shouldHideChrome(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === "/site-access" || pathname.startsWith("/site-access/")) return true;
  if (pathname === "/sell") return true;
  if (pathname.startsWith("/marketplace/admin")) return true;
  if (pathname.startsWith("/dev/design-system")) return true;
  if (pathname.startsWith("/dev/admin-ui")) return true;
  return false;
}

export function TkFooter() {
  const pathname = usePathname();
  const navigate = useHeaderNavGate();
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
          <button type="button" className="navlink" onClick={() => navigate("/vault", 0)}>
            Sell
          </button>
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
