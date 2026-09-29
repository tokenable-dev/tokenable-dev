import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Pixelify_Sans, Press_Start_2P } from "next/font/google";
import "./globals.css";
import "@/styles/tokenable-event.css";
import { Providers } from "./providers";
import { TkHeader } from "@/components/layout/TkHeader";
import { TkFooter } from "@/components/layout/TkFooter";
import { FaqDrawerHost } from "@/components/faq/FaqDrawerHost";
import { ASSETS } from "@/constants/assets";
import { MOBILE_PAGE_SHELL_CLASS } from "@/constants/layout";
import { SiteAnalytics } from "@/components/analytics";
import { PartnerCompanyAddressRequiredModal } from "@/components/partner/PartnerCompanyAddressRequiredModal";
import { AddEmailRequiredModal } from "@/components/auth/AddEmailRequiredModal";
import { KbwMysteryOfferModal } from "@/components/event/KbwMysteryOfferModal";
import { NotificationToastsHost } from "@/components/layout/notifications/NotificationToastsHost";
import { cn } from "@/lib/ds/cn";
import { Suspense } from "react";

const inter = Inter({
  subsets: ["latin"],
  // 300 unused; keep 500 (font-medium / .tk-caption), 800 (home/vault), 900 (event claim).
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

/** KBW `/event` + offer modal — server-only; do not load via client `next/font`. */
const pressStart = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-ev-press",
  display: "swap",
});

const pixelify = Pixelify_Sans({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-ev-pixelify",
  display: "swap",
});

/** Favicon: `app/icon.png` + `tokenable_favicon.png` → `tokenable_icon.png` (dark bg). */
export const metadata: Metadata = {
  title: "Tokenable",
  description:
    "Tokenized collectibles markets: trade markets for authenticated and vaulted gems with instant settlement.",
  openGraph: {
    title: "Tokenable",
    description:
      "Tokenized collectibles markets: trade markets for authenticated and vaulted gems with instant settlement.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Tokenable",
    description:
      "Tokenized collectibles markets: trade markets for authenticated and vaulted gems with instant settlement.",
  },
  icons: {
    icon: [{ url: ASSETS.icons.tokenable, type: "image/png", sizes: "32x32" }],
    apple: [{ url: ASSETS.icons.tokenableApple, sizes: "180x180" }],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${jetbrainsMono.variable} ${pressStart.variable} ${pixelify.variable}`}
    >
      <body className="antialiased tk-ds-surface">
        <Providers>
          <div className="tk-app-shell">
            <div className="tk-shell-scroll">
              <TkHeader />
              <Suspense fallback={null}>
                <PartnerCompanyAddressRequiredModal />
              </Suspense>
              <Suspense fallback={null}>
                <AddEmailRequiredModal />
              </Suspense>
              <Suspense fallback={null}>
                <KbwMysteryOfferModal />
              </Suspense>
              <Suspense fallback={null}>
                <NotificationToastsHost />
              </Suspense>
              <main className={cn(MOBILE_PAGE_SHELL_CLASS, "tk-shell-main flex flex-col")}>
                {children}
              </main>
            </div>
            <TkFooter />
            <FaqDrawerHost />
          </div>
        </Providers>
        <SiteAnalytics />
      </body>
    </html>
  );
}
