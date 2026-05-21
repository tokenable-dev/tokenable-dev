import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppHeader } from "@/components/layout/AppHeader";
import { ASSETS } from "@/constants/assets";

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
    "Mint and trade Tokenable_RWA assets on Ethereum Sepolia. Listings use Seaport.",
  icons: {
    icon: [{ url: ASSETS.icons.tokenable, type: "image/png" }],
    apple: ASSETS.icons.tokenable,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${ibmPlexSans.variable} antialiased`}
      >
        <Providers>
          <AppHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
