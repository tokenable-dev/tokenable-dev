import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppHeader } from "@/components/layout/AppHeader";
import { ASSETS } from "@/constants/assets";
import { MOBILE_PAGE_SHELL_CLASS } from "@/constants/layout";
import { SiteAnalytics } from "@/components/analytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

/** Favicon / apple: `public/assets/icons/tokenable_icon.png` + Next `app/icon.png` (generated metadata). */
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
    icon: [{ url: ASSETS.icons.tokenable, type: "image/png" }],
    apple: ASSETS.icons.tokenable,
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${ibmPlexSans.variable} antialiased`}
      >
        <Providers>
          <AppHeader />
          <div className={MOBILE_PAGE_SHELL_CLASS}>{children}</div>
        </Providers>
        <SiteAnalytics />
      </body>
    </html>
  );
}
