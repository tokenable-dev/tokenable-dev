"use client";

import { useTranslations } from "next-intl";
import { ASSETS } from "@/constants/assets";

function AuthIcon() {
  return (
    <svg width={42} height={42} viewBox="0 0 12 12" shapeRendering="crispEdges" fill="currentColor" aria-hidden>
      <path d="M6 0 1 2v4c0 3 2 4.5 5 6 3-1.5 5-3 5-6V2L6 0Zm0 2.4 3 1.2V6c0 1.8-1.1 2.9-3 3.8C4.1 8.9 3 7.8 3 6V3.6l3-1.2Z" />
      <rect x={5} y={4} width={2} height={4} />
      <rect x={4} y={5} width={4} height={2} />
    </svg>
  );
}

function VaultIcon() {
  return (
    <svg width={42} height={42} viewBox="0 0 12 12" shapeRendering="crispEdges" fill="currentColor" aria-hidden>
      <rect x={1} y={3} width={10} height={8} />
      <rect x={3} y={3} width={6} height={2} fill="#0e0e0e" />
      <rect x={3} y={1} width={6} height={3} />
      <rect x={5} y={6} width={2} height={3} fill="#0e0e0e" />
    </svg>
  );
}

function SettlementIcon() {
  return (
    <svg width={40} height={40} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2 L4 13 L10.5 13 L9 22 L20 10 L13.5 10 Z" />
    </svg>
  );
}

function EthereumMark({ label }: { label: string }) {
  return (
    <span className="feat__eth" aria-label={label}>
      <svg width={16} height={26} viewBox="0 0 256 417" aria-hidden>
        <path fill="#fff" fillOpacity={0.95} d="M127.9 0 125.1 9.5v275.7l2.8 2.8 127.9-75.6z" />
        <path fill="#fff" fillOpacity={0.6} d="M127.9 0 0 212.4l127.9 75.6V0z" />
        <path fill="#fff" fillOpacity={0.95} d="m127.9 312.2-1.6 1.9v98.2l1.6 4.6L256 236.6z" />
        <path fill="#fff" fillOpacity={0.6} d="M127.9 416.9V312.2L0 236.6z" />
      </svg>
      <span>{label}</span>
    </span>
  );
}

export function HomeFeatures() {
  const t = useTranslations("Home");
  return (
    <section id="home-features" className="home-features-band">
      <div className="tkl-wrap home-features-band__inner">
        <div className="home-features-band__intro">
          <h2 className="tkl-sec-title">{t("guaranteesTitle")}</h2>
          <p className="tkl-sec-sub guar-sub">{t("guaranteesCopy")}</p>
        </div>

        <div className="feat-grid">
          <div className="feat">
            <div className="feat__head">
              <div className="feat__ix">
                <AuthIcon />
              </div>
              <span className="feat__num">01</span>
            </div>
            <h3>{t("gradedTitle")}</h3>
            <p>{t("gradedCopy")}</p>
            <div className="feat__brand-logos">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ASSETS.ds.partners.psa} alt="PSA" style={{ height: 20 }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ASSETS.ds.partners.beckett} alt="BGS (Beckett)" style={{ height: 30 }} />
            </div>
          </div>

          <div className="feat">
            <div className="feat__head">
              <div className="feat__ix">
                <VaultIcon />
              </div>
              <span className="feat__num">02</span>
            </div>
            <h3>{t("vaultTitle")}</h3>
            <p>{t("vaultCopy")}</p>
            <div className="feat__brand-logos">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ASSETS.ds.partners.psa} alt="PSA" style={{ height: 20 }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ASSETS.ds.partners.fanatics} alt="Fanatics" style={{ height: 22 }} />
            </div>
          </div>

          <div className="feat">
            <div className="feat__head">
              <div className="feat__ix">
                <SettlementIcon />
              </div>
              <span className="feat__num">03</span>
            </div>
            <h3>{t("settleTitle")}</h3>
            <p>{t("settleCopy")}</p>
            <div className="feat__brand-logos">
              <EthereumMark label={t("ethereum")} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
