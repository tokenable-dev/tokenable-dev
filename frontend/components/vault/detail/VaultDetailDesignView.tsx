"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { TkButton, TkInput, TkSelect, TkTag } from "@/components/ds";
import { useIsMobileViewport } from "@/hooks/ui/useIsMobileViewport";
import { VaultBreadcrumb } from "@/components/vault/VaultBreadcrumb";
import { VaultStepper } from "@/components/vault/VaultStepper";
import { VaultThumb } from "@/components/vault/VaultThumb";
import {
  VAULT_DETAIL_SCENARIOS,
  withLiveHero,
  type VaultDetailScenario,
  type VaultDetailScenarioKey,
  type VaultPackageCard,
} from "@/lib/vault/vaultDetailScenarios";
import { cn } from "@/lib/ds/cn";

function DetailHero({ hero }: { hero: VaultDetailScenario["hero"] }) {
  return (
    <div className={heroToneClass(hero.tone)}>
      <div className="vault-detail-hero__head">
        <HeroIcon icon={hero.icon} />
        <div className="vault-detail-hero__title">{hero.title}</div>
      </div>
      {hero.sub ? <p className="vault-detail-hero__sub">{hero.sub}</p> : null}
    </div>
  );
}

function EmptyPanelState() {
  return (
    <div className="vault-lb-panel__empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" aria-hidden>
        <rect x="3" y="4" width="14" height="18" rx="2" />
        <rect x="8" y="6" width="13" height="17" rx="2" />
      </svg>
      <div>
        Select a card
        <br />
        from the list to
        <br />
        view details
      </div>
    </div>
  );
}

function HeroIcon({ icon }: { icon: VaultDetailScenario["hero"]["icon"] }) {
  if (icon === "spin") return <span className="vault-spin vault-detail-hero__icon" />;
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
}: {
  scenario: VaultDetailScenario;
  packageCards: Array<{ id: number; name: string; imageUrl: string; grade: string; cert: string }>;
  tracking: { label: string; url: string } | null;
}) {
  return (
    <div className="vault-detail-layout-a">
      <DetailHero hero={scenario.hero} />
      <VaultStepper rich steps={scenario.steps} />
      <PackageInfoCard cards={packageCards} />
      {scenario.ship ? <TrackingCard ship={scenario.ship} tracking={tracking} /> : null}
      <NotifBanner msg={scenario.notif} />
      <CtaRow ctas={scenario.cta} />
    </div>
  );
}

function PackageInfoCard({
  cards,
}: {
  cards: Array<{ id: number; name: string; imageUrl: string; grade: string; cert: string }>;
}) {
  const count = cards.length;
  return (
    <div className="vault-card-box vault-detail-package">
      <div className="vault-detail-package__head">
        <span className="vault-detail-package__meta">
          {count} {count === 1 ? "card" : "cards"}
        </span>
      </div>
      {count === 0 ? (
        <p className="px-1 py-3 text-sm text-white/40">No cards in this submission.</p>
      ) : (
        <ul className="vault-detail-package__list">
          {cards.map((c, i) => (
            <li
              key={c.cert || c.id}
              className={cn("vault-detail-package__row", i > 0 && "vault-detail-package__row--border")}
            >
              <div className="vault-detail-package__thumb">
                <VaultThumb src={c.imageUrl} width={40} height={56} className="h-full w-full object-contain" />
              </div>
              <div className="vault-detail-package__name">{c.name}</div>
              <TkTag tone="neutral" appearance="soft" className="vault-detail-grade-tag">
                {c.grade}
              </TkTag>
              <span className="mono vault-detail-package__cert">#{c.cert}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TrackingCard({
  ship,
  tracking,
}: {
  ship: "pending" | "intransit";
  tracking: { label: string; url: string } | null;
}) {
  if (ship === "pending") {
    return (
      <div className="vault-card-box vault-detail-tracking">
        <span className="vault-detail-section-label vault-detail-section-label--box">
          Register Tracking Number
        </span>
        <div className="vault-detail-tracking-form">
          <TkSelect defaultValue="fedex" disabled aria-label="Carrier">
            <option value="fedex">FedEx</option>
            <option value="dhl">DHL Express</option>
            <option value="ups">UPS</option>
            <option value="ems">Korea Post EMS</option>
          </TkSelect>
          <TkInput placeholder="Tracking number" disabled aria-label="Tracking number" />
        </div>
        <Link href="/sell/shipping" className="tk-btn tk-btn--primary vault-detail-tracking-cta">
          Register Tracking →
        </Link>
      </div>
    );
  }

  return (
    <div className="vault-card-box vault-detail-tracking">
      <div className="vault-detail-tracking-done">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--pos)"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>Tracking registered</span>
      </div>
      {tracking ? (
        <a
          href={tracking.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mono vault-detail-tracking-link"
        >
          {tracking.label} ↗
        </a>
      ) : (
        <span className="mono vault-detail-tracking-link">Tracking details pending</span>
      )}
      <div className="vault-detail-tracking-change-wrap">
        <Link href="/sell/shipping" className="tk-btn tk-btn--subtle vault-detail-tracking-change">
          Change Tracking
        </Link>
      </div>
    </div>
  );
}

function NotifBanner({ msg }: { msg: string }) {
  return (
    <div className="vault-detail-notif">
      <span className="vault-detail-notif__icon" aria-hidden>
        🔔
      </span>
      <span className="vault-detail-notif__text">{msg}</span>
      <Link href="/account" className="vault-detail-notif__link">
        Manage Notifications →
      </Link>
    </div>
  );
}

function CtaRow({ ctas }: { ctas: VaultDetailScenario["cta"] }) {
  return (
    <div className="vault-detail-main-actions">
      {ctas.map((cta) => (
        <Link
          key={cta.label}
          href={cta.href}
          className={cn(
            "tk-btn",
            cta.primary ? "tk-btn--primary vault-detail-cta--primary" : "tk-btn--subtle vault-detail-cta--subtle",
          )}
        >
          {cta.label}
        </Link>
      ))}
    </div>
  );
}

function cardStatusRight(card: VaultPackageCard) {
  switch (card.status) {
    case "completed":
      return (
        <>
          <span className="mono vault-lm-row__status vault-lm-row__status--pos">Live</span>
          <span className="mono vault-lm-row__token">View listing →</span>
        </>
      );
    case "approved":
      return <span className="mono vault-lm-row__status vault-lm-row__status--pos">Approved</span>;
    case "reviewing":
      return (
        <span className="mono vault-lm-row__status vault-lm-row__status--azure">
          <span className="vault-spin vault-lm-row__spin" />
          Reviewing
        </span>
      );
    case "failed":
      return <span className="vault-lm-row__status vault-lm-row__status--neg">Failed</span>;
    case "rejected":
      return (
        <>
          <span className="vault-lm-row__status vault-lm-row__status--neg">Rejected</span>
          {card.reason ? <div className="vault-lm-row__reason">{card.reason}</div> : null}
        </>
      );
    default:
      return null;
  }
}

function CardDetailPanel({ card }: { card: VaultPackageCard }) {
  const stMap: Record<string, [string, string]> = {
    completed: ["Live", "var(--pos)"],
    approved: ["Queued", "var(--amber)"],
    reviewing: ["Reviewing", "var(--amber)"],
    failed: ["Failed", "var(--neg)"],
    rejected: ["Rejected", "var(--neg)"],
  };
  const stv = stMap[card.status] ?? ["—", "rgba(255,255,255,0.3)"];
  const stored =
    card.status === "approved" || card.status === "completed" || card.status === "failed";

  return (
    <div className="vault-lb-panel">
      <div className="vault-lb-panel__hero">
        <div className={cn("vault-lb-panel__img", card.status === "rejected" && "vault-lb-panel__img--dim")}>
          <VaultThumb src={card.imageUrl} width={150} height={210} className="h-full w-full object-contain" />
        </div>
        <div className="vault-lb-panel__name">{card.name}</div>
      </div>
      <span className="vault-detail-section-label vault-detail-section-label--box">Card Details</span>
      <div className="vault-detail-row">
        <span className="vault-detail-k">Graded By</span>
        <span className="vault-detail-v">PSA · {card.grade}</span>
      </div>
      <div className="vault-detail-row">
        <span className="vault-detail-k">Cert #</span>
        <span className="vault-detail-v mono">{card.cert}</span>
      </div>
      <div className="vault-detail-row">
        <span className="vault-detail-k">Stored</span>
        <span className="vault-detail-v mono text-white/50">{stored ? "PSA Vault" : "—"}</span>
      </div>
      <div className="vault-detail-row">
        <span className="vault-detail-k">Status</span>
        <span className="vault-detail-v" style={{ color: stv[1] }}>
          {stv[0]}
        </span>
      </div>
      {card.status === "completed" ? (
        <Link href="/portfolio" className="mt-4 inline-flex w-full">
          <TkButton decorative variant="primary" size="md" className="h-11 w-full justify-center text-[13.5px]">
            View in Portfolio →
          </TkButton>
        </Link>
      ) : null}
      {card.status === "reviewing" ? (
        <div className="vault-lb-panel__pending">
          <span className="vault-detail-section-label vault-detail-section-label--muted">Vault Review</span>
          <span className="vault-spin vault-lb-panel__pending-spin" />
          <div>PSA inspection in progress…</div>
        </div>
      ) : null}
      {card.status === "approved" ? (
        <div className="vault-lb-panel__approved">
          Verified and stored. Your listing will go live shortly.
        </div>
      ) : null}
      {card.status === "rejected" ? (
        <>
          <div className="vault-lb-panel__rejected-box">
            <span className="vault-detail-section-label vault-detail-section-label--box">Rejection Detail</span>
            <div className="vault-detail-row">
              <span className="vault-detail-k">Reason</span>
              <span className="vault-detail-v text-[var(--neg)]">{card.reason}</span>
            </div>
            <div className="vault-detail-row">
              <span className="vault-detail-k">Return</span>
              <span className="vault-detail-v">Collect on delivery</span>
            </div>
            <div className="vault-detail-row">
              <span className="vault-detail-k">Est. Return</span>
              <span className="vault-detail-v">5–10 business days</span>
            </div>
          </div>
          <TkButton decorative variant="subtle" size="md" className="mt-4 h-11 w-full justify-center text-[13.5px]">
            Contact Support →
          </TkButton>
        </>
      ) : null}
      {card.status === "failed" ? (
        <>
          <div className="vault-lb-panel__failed-box">
            <span className="vault-detail-section-label vault-detail-section-label--box">Error</span>
            <div className="vault-detail-row">
              <span className="vault-detail-k">Reason</span>
              <span className="vault-detail-v">
                Your card is safe at PSA — we&apos;re having trouble getting the listing live.
              </span>
            </div>
            <div className="vault-detail-row">
              <span className="vault-detail-k">Status</span>
              <span className="vault-detail-v text-[var(--amber)]">Retrying automatically…</span>
            </div>
          </div>
          <TkButton decorative variant="subtle" size="md" className="mt-4 h-11 w-full justify-center text-[13.5px]">
            Contact Support →
          </TkButton>
        </>
      ) : null}
    </div>
  );
}

function DetailBottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);
  const dragYRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setDragY(0);
      setDragging(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      <button type="button" className="vault-lb-sheet-overlay open" aria-label="Close" onClick={onClose} />
      <div
        className={cn("vault-lb-sheet", open && "open", dragging && "vault-lb-sheet--dragging")}
        role="dialog"
        aria-modal="true"
        style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div
          className="vault-lb-sheet__handle"
          aria-hidden
          onTouchStart={(e) => {
            setDragging(true);
            startYRef.current = e.touches[0]!.clientY;
            setDragY(0);
          }}
          onTouchMove={(e) => {
            if (!dragging) return;
            const delta = Math.max(0, e.touches[0]!.clientY - startYRef.current);
            dragYRef.current = delta;
            setDragY(delta);
          }}
          onTouchEnd={() => {
            setDragging(false);
            if (dragYRef.current > 100) onClose();
            dragYRef.current = 0;
            setDragY(0);
          }}
        />
        <div className="vault-lb-sheet__content">{children}</div>
      </div>
    </>
  );
}

function LayoutB({
  scenario,
  cards,
}: {
  scenario: VaultDetailScenario;
  cards: VaultPackageCard[];
}) {
  const isMobile = useIsMobileViewport(1024);
  const stage = scenario.stage ?? "vault";
  const pillDefs =
    stage === "vault"
      ? [
          { key: "approved" as const, icon: "✅", label: "Approved" },
          { key: "reviewing" as const, icon: "⏳", label: "Reviewing" },
          { key: "rejected" as const, icon: "🔴", label: "Rejected" },
        ]
      : [
          { key: "completed" as const, icon: "✅", label: "Completed" },
          { key: "failed" as const, icon: "🔴", label: "Failed" },
        ];
  const tabDefs =
    stage === "vault"
      ? [
          { key: "all" as const, label: "All" },
          { key: "approved" as const, label: "✅ Approved" },
          { key: "reviewing" as const, label: "⏳ Reviewing" },
          { key: "rejected" as const, label: "🔴 Rejected" },
        ]
      : [
          { key: "all" as const, label: "All" },
          { key: "completed" as const, label: "✅ Completed" },
          { key: "failed" as const, label: "🔴 Failed" },
        ];

  const [filter, setFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setFilter("all");
    setSelectedId(null);
    setSheetOpen(false);
  }, [scenario.key]);

  const handleSelectCard = useCallback(
    (id: number) => {
      setSelectedId(id);
      if (isMobile) setSheetOpen(true);
    },
    [isMobile],
  );

  const handleCloseSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  useEffect(() => {
    if (!isMobile) setSheetOpen(false);
  }, [isMobile]);

  const count = useCallback(
    (key: string) => (key === "all" ? cards.length : cards.filter((c) => c.status === key).length),
    [cards],
  );

  const filtered = filter === "all" ? cards : cards.filter((c) => c.status === filter);
  const selected = selectedId != null ? cards.find((c) => c.id === selectedId) ?? null : null;

  return (
    <div className="vault-detail-layout-b">
      <div className="vault-detail-layout-b__left">
        <DetailHero hero={scenario.hero} />
        <VaultStepper rich steps={scenario.steps} />
        <div className={cn("vault-lm-pills", scenario.pillCols === 2 && "vault-lm-pills--2")}>
          {pillDefs.map((pill) => (
            <button
              key={pill.key}
              type="button"
              className={cn("vault-stat-pill", filter === pill.key && "active")}
              onClick={() => setFilter(pill.key)}
            >
              <div className="vault-stat-pill__num">
                {pill.icon} {count(pill.key)}
              </div>
              <div className="vault-stat-pill__label">{pill.label}</div>
            </button>
          ))}
        </div>
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
        <div className="vault-lm-list">
          {filtered.map((card) => (
            <button
              key={card.id}
              type="button"
              className={cn("vault-lm-row", card.status, selectedId === card.id && "selected")}
              onClick={() => handleSelectCard(card.id)}
            >
              <div className={cn("vault-lm-row__thumb", card.status === "rejected" && "dim")}>
                <VaultThumb src={card.imageUrl} width={38} height={52} className="h-full w-full object-contain" />
              </div>
              <div className="vault-lm-row__body">
                <div className="vault-lm-row__name">{card.name}</div>
                <div className="vault-lm-row__meta">
                  <TkTag tone="neutral" appearance="soft" className="vault-detail-grade-tag vault-detail-grade-tag--list">
                    {card.grade}
                  </TkTag>
                  <span className="mono vault-lm-row__cert">Cert #{card.cert}</span>
                </div>
              </div>
              <div className="vault-lm-row__right">{cardStatusRight(card)}</div>
            </button>
          ))}
        </div>
        <div className="vault-detail-layout-b__notif">
          <NotifBanner msg={scenario.notif} />
        </div>
      </div>
      <aside className={cn("vault-detail-layout-b__right", selected && "selected")}>
        {selected ? (
          <CardDetailPanel card={selected} />
        ) : (
          <EmptyPanelState />
        )}
      </aside>

      <DetailBottomSheet open={isMobile && sheetOpen && selected != null} onClose={handleCloseSheet}>
        {selected ? <CardDetailPanel card={selected} /> : null}
      </DetailBottomSheet>
    </div>
  );
}

function EarlyRejectView() {
  return (
    <>
      <VaultBreadcrumb
        variant="flow"
        items={[{ label: "Sell", href: "/vault" }, { label: "Submission" }]}
      />
      <div className="vault-detail-grid">
        <div className="vault-detail-main">
          <h1 className="vault-detail-page-title">Submission Detail</h1>
          <div className="vault-detail-status-hero vault-detail-status-hero--rejected">
            <div className="vault-detail-status-hero__head">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="vault-detail-status-hero__title">Not Eligible for Vault</div>
            </div>
            <p className="vault-detail-status-hero__desc">
              We currently accept PSA 9 and PSA 10 only. Ineligible cards are returned to the submitter.
            </p>
          </div>
          <VaultStepper variant="rejected" active={1} />
        </div>

        <aside className="vault-detail-aside">
          <div className="vault-card-box">
            <span className="vault-detail-section-label vault-detail-section-label--box">What Happened</span>
            <p className="vault-detail-what-happened">
              We currently accept PSA 9 and PSA 10 graded cards. Cards below that grade are returned.
            </p>
          </div>
          <div className="vault-detail-aside-actions">
            <Link href="/vault/submit" className="inline-flex w-full">
              <TkButton decorative variant="primary" size="md" className="h-12 w-full justify-center text-sm">
                Submit Another Card →
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
}: {
  initialScenario?: VaultDetailScenarioKey;
  submissionId: string;
  /** Real submission items from the API — no demo fallback. */
  livePackageCards?: VaultPackageCard[];
  tracking?: { label: string; url: string } | null;
}) {
  const scenarioKey: Exclude<VaultDetailScenarioKey, "early"> =
    initialScenario === "early" ? "C" : (initialScenario as Exclude<VaultDetailScenarioKey, "early">);

  if (initialScenario === "early") {
    return <EarlyRejectView />;
  }

  const base = VAULT_DETAIL_SCENARIOS[scenarioKey] ?? VAULT_DETAIL_SCENARIOS.C;
  const scenario = withLiveHero(base, submissionId, livePackageCards.length);
  const shellClass =
    scenario.layout === "A" ? "vault-detail-page--layout-a" : "vault-detail-page--layout-b";

  const layoutACards = livePackageCards.map((c) => ({
    id: c.id,
    name: c.name,
    imageUrl: c.imageUrl,
    grade: c.grade,
    cert: c.cert,
  }));

  return (
    <div className={shellClass}>
      <VaultBreadcrumb
        variant="flow"
        items={[{ label: "Sell", href: "/vault" }, { label: submissionId }]}
      />

      <h1 className="vault-detail-page-title">Submission Detail</h1>

      {scenario.layout === "A" ? (
        <LayoutAContent
          scenario={scenario}
          packageCards={layoutACards}
          tracking={tracking}
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
