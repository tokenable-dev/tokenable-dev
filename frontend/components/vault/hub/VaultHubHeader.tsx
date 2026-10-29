"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

/** Sell hub header — Vault-Dashboard-Active.html */
export function VaultHubHeader() {
  const t = useTranslations("Sell");
  return (
    <div className="vault-dash-head">
      <h1 className="vault-dash-title">{t("hubTitle")}</h1>
      <Link href="/sell/flow" className="vault-dash-add">
        <span className="vault-dash-add__t">{t("sellCards")}</span>
      </Link>
      <h2 className="vault-dash-sec">{t("vaultingProgress")}</h2>
    </div>
  );
}
