"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ASSETS } from "@/constants/assets";
import {
  isMarketplaceCollectionDetailPath,
  shouldHideAppChrome,
} from "@/constants/layout";

export function TkFooter() {
  const pathname = usePathname();
  if (shouldHideAppChrome(pathname)) return null;

  const hideOnMobile = isMarketplaceCollectionDetailPath(pathname);

  return (
    <footer className={hideOnMobile ? "tk-footer tk-footer--cd-desktop-only" : "tk-footer"}>
      <div className="tk-footer__inner">
        <div className="tk-footer__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ASSETS.logo.tokenableDs} alt="Tokenable" />
          <span className="tk-footer__copy">Collectibles markets © 2026</span>
        </div>
        <nav className="tk-footer__nav" aria-label="Footer">
          {/* data-faq-open → FaqDrawerHost bottom drawer; href=/faq is no-JS fallback */}
          <Link href="/faq" className="navlink" data-faq-open>
            FAQ
          </Link>
          <span className="navlink">Terms</span>
          <span className="tk-footer__socials">
            <a
              className="tk-footer__social"
              href="https://www.instagram.com/tokenable_io"
              target="_blank"
              rel="noopener"
              aria-label="Instagram"
              title="Instagram"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a
              className="tk-footer__social"
              href="https://x.com/tokenable_io"
              target="_blank"
              rel="noopener"
              aria-label="X (Twitter)"
              title="X (Twitter)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M17.75 3h3.07l-6.71 7.67L22 21h-6.18l-4.84-6.33L5.44 21H2.37l7.18-8.2L2 3h6.33l4.38 5.79L17.75 3Zm-1.08 16.18h1.7L7.4 4.73H5.58l11.09 14.45Z" />
              </svg>
            </a>
            <a
              className="tk-footer__social"
              href="https://www.linkedin.com/company/tokenable-io"
              target="_blank"
              rel="noopener"
              aria-label="LinkedIn"
              title="LinkedIn"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.75h4V21H3V9.75Zm6.5 0h3.83v1.54h.06c.53-1.01 1.84-2.07 3.79-2.07 4.05 0 4.8 2.67 4.8 6.13V21h-4v-4.98c0-1.19-.02-2.72-1.66-2.72-1.66 0-1.92 1.3-1.92 2.63V21h-4V9.75Z" />
              </svg>
            </a>
          </span>
        </nav>
      </div>
    </footer>
  );
}
