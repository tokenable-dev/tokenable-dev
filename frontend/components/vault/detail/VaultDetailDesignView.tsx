"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { TkButton, TkTag } from "@/components/ds";
import { ASSETS } from "@/constants/assets";
import { useIsMobileViewport } from "@/hooks/ui/useIsMobileViewport";
import { VaultBreadcrumb } from "@/components/vault/VaultBreadcrumb";
import { VaultBadge } from "@/components/vault/VaultBadge";
import { VaultDemoToggle } from "@/components/vault/VaultDemoToggle";
import { VaultStepper } from "@/components/vault/VaultStepper";
import {
  buildPackageCards,
  resolveDetailScenarioKey,
  VAULT_DETAIL_SCENARIOS,
  type VaultDetailScenario,
  type VaultDetailScenarioKey,
  type VaultPackageCard,
} from "@/lib/vault/vaultDetailScenarios";
import {
  MOCK_SUBMISSION_ID,
  VAULT_DETAIL_SHIP_ADDRESS,
} from "@/lib/vault/vaultMockData";
import { cn } from "@/lib/ds/cn";

const SCENARIO_OPTIONS: { id: VaultDetailScenarioKey; label: string }[] = [
  { id: "A", label: "A·Draft" },
  { id: "B", label: "B·Pending" },
  { id: "C", label: "C·Transit" },
  { id: "D", label: "D·Review" },
  { id: "E", label: "E·Approved" },
  { id: "F", label: "F·Rejected" },
  { id: "G", label: "G·Minted" },
  { id: "H", label: "H·Failed" },
  { id: "early", label: "Early Reject" },
];

const PKG_CARDS = [
  { name: "1999 POKEMON BASE SET 1ST EDITION #4 CHARIZARD HOLO", imageUrl: ASSETS.ds.cards.charizard, grade: "PSA 10", cert: "12345678" },
  { name: "2023 POKEMON PROMO SVP #085 PIKACHU VAN GOGH", imageUrl: ASSETS.ds.cards.pikachu, grade: "PSA 9", cert: "22938102" },
  { name: "2003 TOPPS CHROME #111 LEBRON JAMES ROOKIE", imageUrl: ASSETS.ds.cards.lebron, grade: "PSA 10", cert: "55501248" },
];

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

function LayoutAContent({ scenario }: { scenario: VaultDetailScenario }) {
  return (
    <div className="vault-detail-layout-a">
      <DetailHero hero={scenario.hero} />
      <VaultStepper rich steps={scenario.steps} />
      <PackageInfoCard />
      {scenario.ship ? (
        <>
          <ShipToCard />
          <TrackingCard ship={scenario.ship} />
        </>
      ) : null}
      <NotifBanner msg={scenario.notif} />
      <CtaRow ctas={scenario.cta} />
    </div>
  );
}

function PackageInfoCard() {
  return (
    <div className="vault-card-box vault-detail-package">
      <div className="vault-detail-package__head">
        <span className="vault-detail-package__meta">3 cards · Est. $87,512</span>
        <span className="vault-detail-package__date">Submitted Jun 10, 2026</span>
      </div>
      {PKG_CARDS.map((card, i) => (
        <div key={card.cert} className={cn("vault-detail-package__row", i > 0 && "vault-detail-package__row--border")}>
          <div className="vault-detail-package__thumb">
            <Image src={card.imageUrl} alt="" width={40} height={56} className="h-full w-full object-contain" />
          </div>
          <div className="vault-detail-package__name">{card.name}</div>
          <TkTag tone="neutral" appearance="soft" className="vault-detail-grade-tag">
            {card.grade}
          </TkTag>
          <span className="mono vault-detail-package__cert">#{card.cert}</span>
        </div>
      ))}
    </div>
  );
}

function ShipToCard() {
  return (
    <div className="vault-card-box vault-detail-ship-to">
      <span className="vault-detail-section-label vault-detail-section-label--box">Ship To</span>
      <div className="vault-detail-ship-to__addr">
        {VAULT_DETAIL_SHIP_ADDRESS.name}
        <br />
        {VAULT_DETAIL_SHIP_ADDRESS.lines.map((line) => (
          <span key={line}>
            {line}
            <br />
          </span>
        ))}
      </div>
      <div className="vault-detail-ship-to__id">
        <span>Submission ID </span>
        <span className="mono vault-detail-ship-to__id-val">{MOCK_SUBMISSION_ID}</span>
      </div>
      <p className="vault-detail-ship-to__warn">
        Include your Submission ID on the outside of the package. Do not redirect to any other address.
      </p>
      <div className="vault-detail-ship-to__actions">
        <TkButton decorative variant="subtle" size="sm" className="vault-detail-ship-to__btn">
          Copy Address
        </TkButton>
        <TkButton decorative variant="subtle" size="sm" className="vault-detail-ship-to__btn">
          Download Packing Slip
        </TkButton>
      </div>
    </div>
  );
}

function TrackingCard({ ship }: { ship: "pending" | "intransit" }) {
  if (ship === "pending") {
    return (
      <div className="vault-card-box">
        <span className="vault-detail-section-label vault-detail-section-label--box">Register Tracking Number</span>
        <div className="vault-detail-tracking-form">
          <select className="vault-ship-select" defaultValue="fedex">
            <option>FedEx</option>
            <option>DHL Express</option>
            <option>UPS</option>
            <option>Korea Post EMS</option>
          </select>
          <input className="vault-ship-input" placeholder="Tracking number" />
        </div>
        <Link href="/vault/submit/shipping" className="vault-detail-tracking-cta tk-btn tk-btn--primary">
          Register Tracking →
        </Link>
      </div>
    );
  }

  return (
    <div className="vault-card-box">
      <div className="vault-detail-tracking-done">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--pos)" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>Tracking registered</span>
      </div>
      <a
        href="https://www.fedex.com/fedextrack/?trknbr=FX123456789"
        target="_blank"
        rel="noopener noreferrer"
        className="mono vault-detail-tracking-link"
      >
        FedEx · FX123456789 ↗
      </a>
      <button type="button" className="vault-detail-tracking-change tk-btn tk-btn--subtle tk-btn--sm">
        Change Tracking
      </button>
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
        <Link key={cta.label} href={cta.href} className="inline-flex w-full">
          <TkButton
            decorative
            variant={cta.primary ? "primary" : "subtle"}
            size="md"
            className={cn(
              "w-full justify-center",
              cta.primary ? "h-12 text-[15px]" : "h-[42px] text-[13px] text-white/50",
            )}
          >
            {cta.label}
          </TkButton>
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
          <span className="mono vault-lm-row__status vault-lm-row__status--pos">Minted</span>
          <span className="mono vault-lm-row__token">Token {card.token} →</span>
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
      return <span className="vault-lm-row__status vault-lm-row__status--neg">Mint Failed</span>;
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
  const tokenVal =
    card.status === "completed"
      ? card.token
      : card.status === "approved"
        ? "Pending mint…"
        : card.status === "reviewing"
          ? "Pending…"
          : "—";
  const tokenCol =
    card.status === "completed"
      ? "var(--azure)"
      : card.status === "reviewing" || card.status === "approved"
        ? "var(--amber)"
        : "rgba(255,255,255,0.3)";

  return (
    <div className="vault-lb-panel">
      <div className="vault-lb-panel__hero">
        <div className={cn("vault-lb-panel__img", card.status === "rejected" && "vault-lb-panel__img--dim")}>
          <Image src={card.imageUrl} alt="" width={150} height={210} className="h-full w-full object-contain" />
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
        <span className="vault-detail-k">Vault</span>
        <span className="vault-detail-v mono text-white/50">Delaware · Lloyd&apos;s</span>
      </div>
      <div className="vault-detail-row">
        <span className="vault-detail-k">Token</span>
        <span className="vault-detail-v" style={{ color: tokenCol }}>
          {tokenVal}
        </span>
      </div>
      {card.status === "completed" ? (
        <>
          <div className="vault-card-box vault-detail-receipt vault-detail-receipt--panel">
            <span className="vault-detail-section-label vault-detail-section-label--box">Blockchain Receipt</span>
            <div className="vault-detail-row">
              <span className="vault-detail-k">Contract</span>
              <span className="mono text-[var(--azure)]">0x1aB…4cD2</span>
            </div>
            <div className="vault-detail-row">
              <span className="vault-detail-k">Token ID</span>
              <span className="vault-detail-v mono">{card.token}</span>
            </div>
            <div className="vault-detail-row">
              <span className="vault-detail-k">TX Hash</span>
              <span className="mono text-[var(--azure)]">0xf3a…91e2</span>
            </div>
            <TkButton decorative variant="subtle" size="sm" className="vault-detail-receipt__scan mt-2.5 w-full">
              View on Polygonscan →
            </TkButton>
          </div>
          <Link href="/portfolio" className="mt-4 inline-flex w-full">
            <TkButton decorative variant="primary" size="md" className="h-11 w-full justify-center text-[13.5px]">
              View in Portfolio →
            </TkButton>
          </Link>
        </>
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
          Verified and vaulted. Token minting will begin shortly.
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
              <span className="vault-detail-k">Grade</span>
              <span className="vault-detail-v">
                {card.grade}
                {card.submittedGrade ? ` (submitted as ${card.submittedGrade})` : ""}
              </span>
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
            <span className="vault-detail-section-label vault-detail-section-label--box">Mint Error</span>
            <div className="vault-detail-row">
              <span className="vault-detail-k">Reason</span>
              <span className="vault-detail-v">Blockchain error</span>
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

function LayoutB({ scenario }: { scenario: VaultDetailScenario }) {
  const isMobile = useIsMobileViewport(1024);
  const cards = useMemo(() => buildPackageCards(scenario), [scenario]);
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
                <Image src={card.imageUrl} alt="" width={38} height={52} className="h-full w-full object-contain" />
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

const EARLY_REJECT_CARD = {
  name: "1999 POKEMON BASE SET 1ST EDITION #4 CHARIZARD HOLO",
  grade: "PSA 8",
  cert: "12345678",
  imageUrl: ASSETS.ds.cards.charizard,
};

function EarlyRejectTimeline() {
  return (
    <div className="vault-detail-timeline">
      <div className="vault-tl-step">
        <div className="vault-tl-rail">
          <div className="vault-tl-dot vault-tl-dot--done" />
          <div className="vault-tl-line vault-tl-line--muted" />
        </div>
        <div className="vault-tl-body">
          <div className="vault-tl-phase vault-tl-phase--muted">SUBMIT</div>
          <div className="vault-tl-title">Submitted</div>
          <div className="vault-tl-meta">
            <span className="vault-tl-time">2026-06-10 09:14</span>
            <VaultBadge tone="user">USER</VaultBadge>
          </div>
          <div className="vault-tl-desc">Card info submitted · Cert #{EARLY_REJECT_CARD.cert}</div>
        </div>
      </div>
      <div className="vault-tl-step">
        <div className="vault-tl-rail">
          <div className="vault-tl-dot vault-tl-dot--rejected" />
        </div>
        <div className="vault-tl-body">
          <div className="vault-tl-title">Not Accepted</div>
          <div className="vault-tl-meta">
            <span className="vault-tl-time">2026-06-10 09:15</span>
            <VaultBadge tone="system">SYSTEM</VaultBadge>
          </div>
          <div className="vault-tl-desc">PSA 8 confirmed — we currently only accept PSA 9 and above</div>
        </div>
      </div>
    </div>
  );
}

function EarlyRejectView() {
  return (
    <>
      <VaultBreadcrumb
        variant="flow"
        items={[{ label: "My Vault", href: "/vault" }, { label: MOCK_SUBMISSION_ID }]}
      />
      <div className="vault-detail-grid">
        <div className="vault-detail-main">
          <h1 className="vault-detail-page-title">Submission Detail</h1>
          <div className="vault-detail-summary">
            <div className="vault-detail-summary__img">
              <Image src={EARLY_REJECT_CARD.imageUrl} alt="" width={56} height={78} className="h-full w-full object-contain" />
            </div>
            <div className="vault-detail-summary__body">
              <div className="vault-detail-summary__name">{EARLY_REJECT_CARD.name}</div>
              <div className="vault-detail-summary__meta">
                <VaultBadge tone="neutral">{EARLY_REJECT_CARD.grade}</VaultBadge>
                <span className="vault-detail-summary__cert">Cert #{EARLY_REJECT_CARD.cert}</span>
                <VaultBadge tone="neutral" className="vault-badge--polygon">
                  Polygon
                </VaultBadge>
              </div>
            </div>
          </div>
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
              This card is graded PSA 8. We currently accept PSA 9 and PSA 10 only. Your card will be returned to you.
            </p>
          </div>
          <VaultStepper variant="rejected" active={1} />
          <span className="vault-detail-section-label">Timeline</span>
          <EarlyRejectTimeline />
        </div>

        <aside className="vault-detail-aside">
          <div className="vault-card-box vault-detail-aside-image">
            <div className="vault-detail-aside-image__frame">
              <Image src={EARLY_REJECT_CARD.imageUrl} alt="" width={200} height={280} className="h-full w-full object-contain" />
            </div>
          </div>
          <div className="vault-card-box">
            <span className="vault-detail-section-label vault-detail-section-label--box">Card Details</span>
            <div className="vault-detail-row">
              <span className="vault-detail-k">Graded By</span>
              <span className="vault-detail-v">PSA · 8</span>
            </div>
            <div className="vault-detail-row">
              <span className="vault-detail-k">Cert #</span>
              <span className="vault-detail-v mono">{EARLY_REJECT_CARD.cert}</span>
            </div>
            <div className="vault-detail-row">
              <span className="vault-detail-k">Vault</span>
              <span className="vault-detail-v mono text-white/50">Delaware · Lloyd&apos;s</span>
            </div>
            <div className="vault-detail-row">
              <span className="vault-detail-k">Status</span>
              <span className="vault-detail-v text-white/50">Not eligible</span>
            </div>
          </div>
          <div className="vault-card-box">
            <span className="vault-detail-section-label vault-detail-section-label--box">What Happened</span>
            <p className="vault-detail-what-happened">
              We currently accept PSA 9 and PSA 10 graded cards. This card (PSA 8) doesn&apos;t meet the minimum grade.
              We&apos;ll return it to you shortly.
            </p>
          </div>
          <div className="vault-detail-aside-actions">
            <Link href="/vault/submit" className="inline-flex w-full">
              <TkButton decorative variant="primary" size="md" className="h-12 w-full justify-center text-sm">
                Submit Another Card →
              </TkButton>
            </Link>
            <TkButton decorative variant="subtle" size="md" className="h-[42px] w-full justify-center text-[13px]">
              Contact Support
            </TkButton>
          </div>
          <div className="vault-detail-delivery-note">
            <strong>Card Return</strong>
            <br />
            Your card will be returned to the address on file. Return shipping costs are the submitter&apos;s
            responsibility. Please allow 7–10 business days for processing.
          </div>
        </aside>
      </div>
    </>
  );
}


export function VaultDetailDesignView({
  initialScenario = "G",
}: {
  initialScenario?: VaultDetailScenarioKey;
}) {
  const [scenarioKey, setScenarioKey] = useState<VaultDetailScenarioKey>(initialScenario);

  if (scenarioKey === "early") {
    return (
      <>
        <EarlyRejectView />
        <VaultDemoToggle options={SCENARIO_OPTIONS} value={scenarioKey} onChange={setScenarioKey} />
      </>
    );
  }

  const scenario = VAULT_DETAIL_SCENARIOS[scenarioKey];
  const shellClass =
    scenario.layout === "A" ? "vault-detail-page--layout-a" : "vault-detail-page--layout-b";

  return (
    <>
      <div className={shellClass}>
        <VaultBreadcrumb
          variant="flow"
          items={[{ label: "My Vault", href: "/vault" }, { label: MOCK_SUBMISSION_ID }]}
        />

        <h1 className="vault-detail-page-title">Submission Detail</h1>

        {scenario.layout === "A" ? (
          <LayoutAContent scenario={scenario} />
        ) : (
          <>
            <LayoutB scenario={scenario} />
            <CtaRow ctas={scenario.cta} />
          </>
        )}
      </div>

      <VaultDemoToggle options={SCENARIO_OPTIONS} value={scenarioKey} onChange={setScenarioKey} />
    </>
  );
}
