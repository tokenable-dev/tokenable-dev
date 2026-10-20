import localFont from "next/font/local";

/**
 * Self-hosted fonts (next/font/local).
 *
 * Do NOT use `next/font/google` here — Google intermittently serves extensionless
 * `/l/font?kit=…&skey=…` URLs that break Next 16 Turbopack builds
 * (`next/font/google queries have exactly one entry`, vercel/next.js#99114).
 *
 * Files under `./fonts/` are latin subsets from fonts.gstatic.com (committed).
 */

export const inter = localFont({
  src: "./fonts/Inter-latin-wght.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-inter",
  display: "swap",
  adjustFontFallback: "Arial",
});

export const jetbrainsMono = localFont({
  src: "./fonts/JetBrainsMono-latin-wght.woff2",
  weight: "100 800",
  style: "normal",
  variable: "--font-jetbrains-mono",
  display: "swap",
  adjustFontFallback: false,
});

/** KBW `/event` + offer modal — server-only; do not load via client `next/font`. */
export const pressStart = localFont({
  src: "./fonts/PressStart2P-latin.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-ev-press",
  display: "swap",
});

export const pixelify = localFont({
  src: "./fonts/PixelifySans-latin.woff2",
  weight: "400 700",
  style: "normal",
  variable: "--font-ev-pixelify",
  display: "swap",
});
