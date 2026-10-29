"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { TkButton, TkInput, TkSelect } from "@/components/ds";
import { VaultBreadcrumb } from "@/components/vault/VaultBreadcrumb";
import { VaultStepper } from "@/components/vault/VaultStepper";
import { VaultThumb } from "@/components/vault/VaultThumb";
import {
  VAULT_DETAIL_SCENARIOS,
  liveHeroSub,
  type VaultDetailScenario,
  type VaultDetailScenarioKey,
  type VaultPackageCard,
} from "@/lib/vault/vaultDetailScenarios";
import { vaultDetailCardLines } from "@/lib/vault/vaultSubmissionDisplay";
import { formatSellCardDisplay } from "@/lib/sell/sellFlowDraft";
import { cn } from "@/lib/ds/cn";

type T = ReturnType<typeof useTranslations>;

/** Scenario copy holds `VaultDetail.*` keys — resolve them for the active locale. */
function localizeScenario(
  t: T,
  base: VaultDetailScenario,
  sub: { key: string; values?: Record<string, string | number> } | null,
): VaultDetailScenario {
  return {
    ...base,
    hero: {
      ...base.hero,
      title: t(base.hero.title),
      sub: sub ? t(sub.key, sub.values) : t(base.hero.sub),
    },
    steps: base.steps.map((st) => ({
      ...st,
      label: t(st.label),
      sub: st.sub ? t(st.sub) : st.sub,
    })),
    cta: base.cta.map((c) => ({ ...c, label: t(c.label) })),
  };
}

const REASON_KEY: Record<string, string> = {
  "Cert mismatch": "rejectCertMismatch",
  "PSA declined": "rejectPsaDeclined",
  "Grade ineligible": "rejectGradeIneligible",
  "Damaged in transit": "rejectDamaged",
  "Not received": "rejectNotReceived",
};

function formatSubmitDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DetailHero({ hero }: { hero: VaultDetailScenario["hero"] }) {
  return (
    <div className={heroToneClass(hero.tone)}>
      <div className="vault-detail-hero__head">
        <span className="vault-detail-hero__icon-wrap">
          <HeroIcon icon={hero.icon} />
        </span>
        <div className="vault-detail-hero__title">{hero.title}</div>
      </div>
      {hero.sub ? <p className="vault-detail-hero__sub">{hero.sub}</p> : null}
    </div>
  );
}

function HeroIcon({ icon }: { icon: VaultDetailScenario["hero"]["icon"] }) {
  if (icon === "spin") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--azure)" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15.5 14" />
      </svg>
    );
  }
  if (icon === "check") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--pos)" strokeWidth="2.5" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (icon === "x") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--neg)" strokeWidth="2.5" aria-hidden>
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </svg>
    );
  }
  if (icon === "clock") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2.2" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 14" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function heroToneClass(tone: VaultDetailScenario["hero"]["tone"]): string {
  return `vault-detail-hero vault-detail-hero--${tone}`;
}

function LayoutAContent({
  scenario,
  packageCards,
  tracking,
  submissionId,
  submittedAt,
}: {
  scenario: VaultDetailScenario;
  packageCards: VaultPackageCard[];
  tracking: { label: string; url: string } | null;
  submissionId: string;
  submittedAt?: string | null;
}) {
  return (
    <div className="vault-detail-layout-a">
      <DetailHero hero={scenario.hero} />
      <VaultStepper rich steps={scenario.steps} />
      <PackageInfoCard cards={packageCards} submittedAt={submittedAt} />
      {scenario.ship ? (
        <TrackingCard ship={scenario.ship} tracking={tracking} submissionId={submissionId} />
      ) : null}
      {scenario.cta.length > 0 ? <CtaRow ctas={scenario.cta} /> : null}
    </div>
  );
}

function PackageInfoCard({
  cards,
  submittedAt,
}: {
  cards: VaultPackageCard[];
  submittedAt?: string | null;
}) {
  const t = useTranslations("VaultDetail");
  const locale = useLocale();
  const count = cards.length;
  return (
    <div className="vault-card-box vault-detail-package">
      <div className="vault-detail-package__head">
        <span className="vault-detail-package__title">
          <span className="mono">({count})</span> {t("cardsWord", { count })}
        </span>
        {submittedAt ? (
          <span className="vault-detail-package__date">
            {t("submittedOn", { date: formatSubmitDate(submittedAt, locale) })}
          </span>
        ) : null}
      </div>
      {count === 0 ? (
        <p className="px-1 py-3 text-sm text-white/40">{t("noCards")}</p>
      ) : (
        <ul className="vault-detail-package__list">
          {cards.map((c, i) => {
            const { line1, line2 } = formatSellCardDisplay(c);
            return (
              <li
                key={c.cert || c.id}
                className={cn("vault-detail-package__row", i > 0 && "vault-detail-package__row--border")}
              >
                <div className="vault-detail-package__thumb">
                  <VaultThumb src={c.imageUrl} width={40} height={56} className="h-full w-full object-contain" />
                </div>
                <div className="vault-detail-package__copy">
                  <div className="vault-detail-package__name">{line1}</div>
                  {line2 ? <div className="mono vault-detail-package__line2">{line2}</div> : null}
                  <div className="mono vault-detail-package__cert-m">{t("certNo", { cert: c.cert })}</div>
                </div>
                <span className="mono vault-detail-package__cert">#{c.cert}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TrackingCard({
  ship,
  tracking,
  submissionId,
}: {
  ship: "pending" | "intransit";
  tracking: { label: string; url: string } | null;
  submissionId: string;
}) {
  const t = useTranslations("VaultDetail");
  const shippingHref = `/sell/shipping?submission=${encodeURIComponent(submissionId)}`;

  if (ship === "pending") {
    return (
      <div className="vault-card-box vault-detail-tracking">
        <h2 className="vault-detail-tracking__title">{t("addTracking")}</h2>
        <div className="vault-detail-tracking-form">
          <TkSelect defaultValue="fedex" disabled aria-label={t("carrier")}>
            <option value="fedex">FedEx</option>
            <option value="dhl">DHL Express</option>
            <option value="ups">UPS</option>
            <option value="ems">Korea Post EMS</option>
          </TkSelect>
          <TkInput placeholder={t("trackingNumber")} disabled aria-label={t("trackingNumber")} />
        </div>
        <div className="vault-detail-tracking-cta-wrap">
          <Link href={shippingHref} className="tk-btn tk-btn--primary vault-detail-tracking-cta">
            {t("ctaContinue")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="vault-card-box vault-detail-tracking">
      <h2 className="vault-detail-tracking__title">{t("addTracking")}</h2>
      <div className="vault-detail-tracking-done">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5B9AFF"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <div className="vault-detail-tracking-done__body">
          {t("inTransit")}
          {tracking ? (
            <>
              {" · "}
              <span className="mono vault-detail-tracking-done__num">{tracking.label}</span>
            </>
          ) : null}
        </div>
        <Link href={shippingHref} className="vault-detail-tracking-done__edit">
          {t("edit")}
        </Link>
      </div>
    </div>
  );
}

function CtaRow({ ctas }: { ctas: VaultDetailScenario["cta"] }) {
  if (ctas.length === 0) return null;
  return (
    <div className="vault-detail-main-actions">
      {ctas.map((cta) => (
        <Link
          key={cta.label}
          href={cta.href}
          className={cn(
            "tk-btn",
            cta.primary
              ? "tk-btn--primary vault-detail-cta--primary"
              : "tk-btn--subtle vault-detail-cta--subtle",
          )}
        >
          {cta.label}
        </Link>
      ))}
    </div>
  );
}

function cardStatusLabel(t: T, card: VaultPackageCard) {
  const map: Record<VaultPackageCard["status"], [string, string, string]> = {
    completed: ["stLive", "var(--pos)", "rgba(0,200,100,0.14)"],
    approved: ["stApproved", "var(--pos)", "rgba(0,200,100,0.14)"],
    reviewing: ["stReviewing", "var(--azure)", "rgba(26,111,255,0.14)"],
    rejected: ["stRejected", "var(--neg)", "rgba(245,51,44,0.14)"],
    failed: ["stFailed", "var(--neg)", "rgba(245,51,44,0.14)"],
  };
  const s = map[card.status];
  if (!s) return null;
  return (
    <span
      className="mono vault-lm-row__status-pill"
      style={{ color: s[1], background: s[2] }}
    >
      {t(s[0])}
    </span>
  );
}

/** Layout B — list only (Vault-Detail.html: right-panel + sheet selection disabled). */
function LayoutB({
  scenario,
  cards,
}: {
  scenario: VaultDetailScenario;
  cards: VaultPackageCard[];
}) {
  const t = useTranslations("VaultDetail");
  const tSell = useTranslations("Sell");
  const stage = scenario.stage ?? "vault";
  const tabDefs =
    stage === "vault"
      ? [
          { key: "all", label: t("tabAll") },
          { key: "approved", label: `✅ ${t("stApproved")}` },
          { key: "reviewing", label: `⏳ ${t("stReviewing")}` },
          { key: "rejected", label: `🔴 ${t("stRejected")}` },
          // Mint failures in an all-failed (rejected) package — hidden when 0.
          { key: "failed", label: `🔴 ${t("stFailed")}` },
        ]
      : [
          { key: "all", label: t("tabAll") },
          { key: "completed", label: `✅ ${t("tabCompleted")}` },
          { key: "failed", label: `🔴 ${t("stFailed")}` },
          // PSA-rejected cards in a partial (failed) package — hidden when 0.
          { key: "rejected", label: `🔴 ${t("stRejected")}` },
        ];

  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    setFilter("all");
  }, [scenario.key]);

  const count = useCallback(
    (key: string) => (key === "all" ? cards.length : cards.filter((c) => c.status === key).length),
    [cards],
  );

  const filtered = filter === "all" ? cards : cards.filter((c) => c.status === filter);

  return (
    <div className="vault-detail-layout-b">
      <DetailHero hero={scenario.hero} />
      <VaultStepper rich steps={scenario.steps} />
      <div className="vault-lm-tabs">
        {tabDefs.map((tab) => {
          const n = count(tab.key);
          if (tab.key !== "all" && n === 0) return null;
          return (
            <button
              key={tab.key}
              type="button"
              className={cn("vault-lm-filter-tab", filter === tab.key && "active")}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label} {n}
            </button>
          );
        })}
      </div>
      <div className="vault-card-box vault-lm-list-box">
        <div className="vault-lm-list">
          {filtered.map((card) => {
            const { line1, listLine2, certLine } = vaultDetailCardLines(card);
            return (
              <div key={card.id} className={cn("vault-lm-row", card.status)}>
                <div className={cn("vault-lm-row__thumb", card.status === "rejected" && "dim")}>
                  <VaultThumb src={card.imageUrl} width={64} height={90} className="h-full w-full object-contain" />
                </div>
                <div className="vault-lm-row__body">
                  <div className="vault-lm-row__name-line">
                    <span className="vault-lm-row__name">{line1}</span>
                    {cardStatusLabel(t, card)}
                  </div>
                  {listLine2 ? (
                    <div className="vault-lm-row__subline mono">{listLine2}</div>
                  ) : null}
                  {certLine ? (
                    <div className="mono vault-lm-row__cert-line">{certLine}</div>
                  ) : null}
                  {card.status === "completed" ? (
                    <div className="vault-lm-row__under">
                      <span className="vault-lm-row__listing">{t("viewListing")}</span>
                    </div>
                  ) : null}
                  {card.status === "rejected" && card.reason ? (
                    <div className="vault-lm-row__under vault-lm-row__under--neg">
                      {REASON_KEY[card.reason] ? tSell(REASON_KEY[card.reason]) : card.reason}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EarlyRejectView() {
  const t = useTranslations("VaultDetail");
  return (
    <>
      <VaultBreadcrumb
        variant="flow"
        items={[{ label: t("crumbSell"), href: "/vault" }, { label: t("crumbSubmission") }]}
      />
      <div className="vault-detail-grid">
        <div className="vault-detail-main">
          <h1 className="vault-detail-page-title">{t("detailTitle")}</h1>
          <div className="vault-detail-status-hero vault-detail-status-hero--rejected">
            <div className="vault-detail-status-hero__head">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="vault-detail-status-hero__title">{t("earlyTitle")}</div>
            </div>
            <p className="vault-detail-status-hero__desc">
              {t("earlyDesc")}
            </p>
          </div>
          <VaultStepper variant="rejected" active={1} />
        </div>

        <aside className="vault-detail-aside">
          <div className="vault-card-box">
            <span className="vault-detail-section-label vault-detail-section-label--box">{t("whatHappened")}</span>
            <p className="vault-detail-what-happened">
              {t("whatHappenedBody")}
            </p>
          </div>
          <div className="vault-detail-aside-actions">
            <Link href="/vault/submit" className="inline-flex w-full">
              <TkButton decorative variant="primary" size="md" className="h-12 w-full justify-center text-sm">
                {t("ctaSubmitAnother")} →
              </TkButton>
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}


export function VaultDetailDesignView({
  initialScenario = "C",
  submissionId,
  livePackageCards = [],
  tracking = null,
  submittedAt = null,
}: {
  initialScenario?: VaultDetailScenarioKey;
  submissionId: string;
  /** Real submission items from the API — no demo fallback. */
  livePackageCards?: VaultPackageCard[];
  tracking?: { label: string; url: string } | null;
  submittedAt?: string | null;
}) {
  const t = useTranslations("VaultDetail");
  const scenarioKey: Exclude<VaultDetailScenarioKey, "early"> =
    initialScenario === "early" ? "C" : (initialScenario as Exclude<VaultDetailScenarioKey, "early">);

  if (initialScenario === "early") {
    return <EarlyRejectView />;
  }

  const base = VAULT_DETAIL_SCENARIOS[scenarioKey] ?? VAULT_DETAIL_SCENARIOS.C;
  const scenario = localizeScenario(
    t,
    base,
    liveHeroSub(scenarioKey, submissionId, livePackageCards),
  );
  const shellClass = cn(
    scenario.layout === "A" ? "vault-detail-page--layout-a" : "vault-detail-page--layout-b",
    `vault-detail-page--${scenarioKey.toLowerCase()}`,
  );

  const layoutACards = livePackageCards;

  return (
    <div className={shellClass}>
      <VaultBreadcrumb
        variant="flow"
        items={[{ label: t("crumbSell"), href: "/vault" }, { label: submissionId }]}
      />

      <h1 className="vault-detail-page-title">{t("pageTitle")}</h1>

      {scenario.layout === "A" ? (
        <LayoutAContent
          scenario={scenario}
          packageCards={layoutACards}
          tracking={tracking}
          submissionId={submissionId}
          submittedAt={submittedAt}
        />
      ) : (
        <>
          <LayoutB scenario={scenario} cards={livePackageCards} />
          <CtaRow ctas={scenario.cta} />
        </>
      )}
    </div>
  );
}
