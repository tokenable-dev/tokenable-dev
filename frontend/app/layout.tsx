import type { Metadata } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import {
  inter,
  jetbrainsMono,
  pixelify,
  pressStart,
} from "./fonts";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      data-theme="dark"
      className={`${inter.variable} ${jetbrainsMono.variable} ${pressStart.variable} ${pixelify.variable}`}
    >
      <body className="antialiased tk-ds-surface">
        <NextIntlClientProvider locale={locale} messages={messages}>
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
        </NextIntlClientProvider>
        <SiteAnalytics />
      </body>
    </html>
  );
}
