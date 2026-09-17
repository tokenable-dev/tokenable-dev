import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Pixelify_Sans, Press_Start_2P } from "next/font/google";
import "@/styles/tokenable-event.css";

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

export const metadata: Metadata = {
  title: "Play the Market — Tokenable",
  description: "Tokenable event for Korea Blockchain Week.",
};

export default function EventLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${pressStart.variable} ${pixelify.variable}`}>
      {children}
    </div>
  );
}
