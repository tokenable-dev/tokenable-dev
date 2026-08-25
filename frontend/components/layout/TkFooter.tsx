"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ASSETS } from "@/constants/assets";
import {
  isMarketplaceCollectionDetailPath,
  shouldHideAppChrome,
} from "@/constants/layout";
import { useHeaderNavGate } from "@/hooks/auth/useHeaderNavGate";

export function TkFooter() {
  const pathname = usePathname();
  const navigate = useHeaderNavGate();
  if (shouldHideAppChrome(pathname)) return null;

  const hideOnMobile = isMarketplaceCollectionDetailPath(pathname);

  return (
    <footer className={hideOnMobile ? "tk-footer tk-footer--cd-desktop-only" : "tk-footer"}>
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
