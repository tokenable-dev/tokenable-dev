"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { TkButton } from "@/components/ds";
import { VaultBreadcrumb } from "@/components/vault/VaultBreadcrumb";
import { VaultBadge } from "@/components/vault/VaultBadge";
import { VaultDemoToggle } from "@/components/vault/VaultDemoToggle";
import { VaultStepper } from "@/components/vault/VaultStepper";
import { MOCK_CARD, MOCK_SUBMISSION_ID } from "@/lib/vault/vaultMockData";

type DetailView = "minting" | "completed" | "rejected";

type TimelineStep = {
  phase?: string;
  title: string;
  time: string;
  badge: "user" | "system" | "webhook" | "admin" | "blockchain" | "neutral";
  desc: string;
  state: "done" | "active" | "pending" | "rejected";
};

const LOG_LINES = [
  { time: "16:02", actor: "webhook" as const, msg: "PSA Vault intake confirmed" },
  { time: "14:30", actor: "system" as const, msg: "Shipping guide sent to email" },
  { time: "09:14", actor: "system" as const, msg: "Grade verified · PSA 10" },
  { time: "09:14", actor: "user" as const, msg: "Submission created" },
  { time: "09:00", actor: "user" as const, msg: "FedEx tracking registered · FX123456789" },
  { time: "--:--", actor: "blockchain" as const, msg: "ERC-721 mint tx submitted…", pending: true },
];

const TIMELINE_REJECTED: TimelineStep[] = [
  {
    phase: "SUBMIT",
    title: "Submitted",
    time: "2026-06-10 09:14",
    badge: "user",
    desc: "Card info submitted · Cert #12345678",
    state: "done",
  },
  {
    title: "Not Accepted",
    time: "2026-06-10 09:15",
    badge: "system",
    desc: "PSA 8 confirmed — we currently only accept PSA 9 and above",
    state: "rejected",
  },
];

function renderTimeline(steps: TimelineStep[]) {
  return steps.map((step, i, arr) => (
    <div
      key={`${step.title}-${i}`}
      className={`vault-tl-step${step.state === "pending" ? " pending" : ""}`}
    >
      <div className="vault-tl-rail">
        <div
          className={`vault-tl-dot ${
            step.state === "active"
              ? "vault-tl-dot--active"
              : step.state === "pending"
                ? "vault-tl-dot--pending"
                : step.state === "rejected"
                  ? "vault-tl-dot--rejected"
                  : "vault-tl-dot--done"
          }`}
        />
        {i < arr.length - 1 ? (
          <div
            className={`vault-tl-line ${
              step.state === "active"
                ? "vault-tl-line--active"
                : step.state === "pending" || step.state === "rejected"
                  ? "vault-tl-line--muted"
                  : "vault-tl-line--done"
            }`}
          />
        ) : null}
      </div>
      <div className="vault-tl-body">
        {step.phase ? <div className="vault-tl-phase">{step.phase}</div> : null}
        <div className={`vault-tl-title${step.state === "active" ? " vault-tl-title--active" : ""}`}>{step.title}</div>
        <div className="vault-tl-meta">
          {step.time ? <span className="vault-tl-time">{step.time}</span> : null}
          {step.state === "active" ? (
            <span className="vault-tl-status vault-tl-status--active">In Progress</span>
          ) : null}
          {step.state === "pending" ? (
            <span className="vault-tl-status vault-tl-status--pending">Pending</span>
          ) : null}
          {step.badge !== "neutral" ? <VaultBadge tone={step.badge}>{step.badge.toUpperCase()}</VaultBadge> : null}
        </div>
        <div className="vault-tl-desc">
          {step.desc}
          {step.state === "active" ? <span className="vault-spin vault-tl-spin" /> : null}
        </div>
      </div>
    </div>
  ));
}

function DetailRow({ label, value, href }: { label: string; value: ReactNode; href?: string }) {
  return (
    <div className="vault-detail-row">
      <span className="vault-detail-k">{label}</span>
      {href ? (
        <a href={href} className="vault-detail-v vault-detail-v--link">
          {value}
        </a>
      ) : (
        <span className="vault-detail-v">{value}</span>
      )}
    </div>
  );
}

export function VaultDetailDesignView({ initialView = "minting" }: { initialView?: DetailView }) {
  const [view, setView] = useState<DetailView>(initialView);
  const isRejected = view === "rejected";
  const isCompleted = view === "completed";
  const card = isRejected ? { ...MOCK_CARD, grade: "PSA 8" } : MOCK_CARD;

  const timelineMinting: TimelineStep[] = [
    { phase: "VERIFY", title: "Submitted", time: "2026-06-10 09:14", badge: "user", desc: "Card info submitted · Cert #12345678", state: "done" },
    { title: "Verified", time: "2026-06-10 09:14", badge: "system", desc: "PSA lookup success · Grade PSA 10 confirmed", state: "done" },
    { phase: "SHIP", title: "Shipped", time: "2026-06-12 09:00", badge: "user", desc: "FedEx · FX123456789 · Shipped from Seoul, KR", state: "done" },
    { title: "Delivered", time: "2026-06-14 11:30", badge: "webhook", desc: "Package received at vault facility", state: "done" },
    { phase: "VAULT", title: "Intake Verified", time: "2026-06-15 16:02", badge: "webhook", desc: "PSA Vault intake confirmed · Cert matched", state: "done" },
    { title: "Insured & Vaulted", time: "2026-06-16 10:30", badge: "system", desc: "Insurance coverage confirmed · Lloyd's of London", state: "done" },
    { phase: "TOKENIZE", title: "Mint Token", time: "", badge: "system", desc: "ERC-721 minting on Polygon…", state: "active" },
    { title: "Completed", time: "", badge: "neutral", desc: "Token will be sent to 0x7Fb…3aE2", state: "pending" },
  ];

  const timelineCompleted: TimelineStep[] = [
    { phase: "VERIFY", title: "Submitted", time: "2026-06-10 09:14", badge: "user", desc: "Card info submitted · Cert #12345678", state: "done" },
    { title: "Verified", time: "2026-06-10 09:14", badge: "system", desc: "PSA lookup success · Grade PSA 10 confirmed", state: "done" },
    { phase: "SHIP", title: "Shipped", time: "2026-06-12 09:00", badge: "user", desc: "FedEx · FX123456789 · Shipped from Seoul, KR", state: "done" },
    { title: "Delivered", time: "2026-06-14 11:30", badge: "webhook", desc: "Package received at vault facility", state: "done" },
    { phase: "VAULT", title: "Intake Verified", time: "2026-06-15 16:02", badge: "webhook", desc: "PSA Vault intake confirmed · Cert matched", state: "done" },
    { title: "Insured & Vaulted", time: "2026-06-16 10:30", badge: "system", desc: "Insurance coverage confirmed · Lloyd's of London", state: "done" },
    { phase: "TOKENIZE", title: "Token Minted", time: "2026-06-17 14:22", badge: "blockchain", desc: `ERC-721 minted on Polygon · Token #${MOCK_CARD.tokenId}`, state: "done" },
    { title: "Completed", time: "2026-06-17 14:23", badge: "system", desc: `Token #${MOCK_CARD.tokenId} sent to 0x7Fb…3aE2`, state: "done" },
  ];

  const timeline = isRejected ? TIMELINE_REJECTED : isCompleted ? timelineCompleted : timelineMinting;

  return (
    <>
      <VaultBreadcrumb
        variant="flow"
        items={[
          { label: "My Vault", href: "/vault" },
          { label: MOCK_SUBMISSION_ID },
        ]}
      />

      <div className="vault-detail-grid">
        <div className="vault-detail-main">
          <h1 className="vault-detail-page-title">Submission Detail</h1>

          <div className="vault-detail-summary">
            <div className="vault-detail-summary__img">
              <Image src={card.imageUrl} alt="" width={56} height={78} className="h-full w-full object-contain" />
            </div>
            <div className="vault-detail-summary__body">
              <div className="vault-detail-summary__name">{card.name}</div>
              <div className="vault-detail-summary__meta">
                <VaultBadge tone={isRejected ? "neutral" : "grade"}>{card.grade}</VaultBadge>
                <span className="vault-detail-summary__cert">Cert #{card.cert}</span>
                <span className="vault-badge vault-badge--webhook vault-detail-summary__chain">Polygon</span>
              </div>
            </div>
          </div>

          {isRejected ? (
            <div className="vault-detail-status-hero vault-detail-status-hero--rejected">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <div className="vault-detail-status-hero__title">Not Eligible for Vault</div>
                <p className="vault-detail-status-hero__desc">
                  This card is graded PSA 8. We currently accept PSA 9 and PSA 10 only. Your card will be returned to you.
                </p>
              </div>
            </div>
          ) : isCompleted ? (
            <div className="vault-detail-status-hero vault-detail-status-hero--completed">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--pos)" strokeWidth="2.5" aria-hidden>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <div>
                <div className="vault-detail-status-hero__title">Minting Complete</div>
                <p className="vault-detail-status-hero__desc">
                  Your token has been minted and sent to your wallet. This card is now available in your Portfolio.
                </p>
              </div>
            </div>
          ) : (
            <div className="vault-detail-status-hero vault-detail-status-hero--minting">
              <span className="vault-spin vault-detail-status-hero__spin" />
              <div>
                <div className="vault-detail-status-hero__title">Minting in Progress</div>
                <p className="vault-detail-status-hero__desc">
                  Your token is being created on Polygon. Usually completes within 24 hours.
                </p>
              </div>
            </div>
          )}

          <VaultStepper
            active={isRejected ? 1 : isCompleted ? 5 : 4}
            variant={isRejected ? "rejected" : "default"}
          />

          <span className="vault-detail-section-label">Timeline</span>
          <div className="vault-detail-timeline">{renderTimeline(timeline)}</div>

          {!isRejected && !isCompleted ? (
            <div className="vault-detail-live">
              <div className="vault-detail-live__head">
                <span className="vault-detail-section-label vault-detail-section-label--inline">Live Activity</span>
                <span className="vault-detail-live__hint">Auto-refreshes every 30s</span>
              </div>
              <div className="vault-log-wrap">
                {LOG_LINES.map((line) => (
                  <div key={`${line.time}-${line.msg}`} className="vault-log-line">
                    <span className="vault-log-time">{line.time}</span>
                    <span className="vault-log-actor">
                      <VaultBadge tone={line.actor} style={{ fontSize: 10, padding: "2px 6px" }}>
                        {line.actor}
                      </VaultBadge>
                    </span>
                    <span className="vault-log-msg">
                      {line.msg}
                      {"pending" in line && line.pending ? <span className="vault-spin vault-log-spin" /> : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!isRejected && !isCompleted ? (
            <div className="vault-detail-notif">
              <span className="vault-detail-notif__icon" aria-hidden>
                🔔
              </span>
              <span className="vault-detail-notif__text">We&apos;ll notify you by email when your token is ready.</span>
              <Link href="/account" className="vault-detail-notif__link">
                Manage Notifications →
              </Link>
            </div>
          ) : null}

          {isCompleted ? (
            <>
              <div className="vault-card-box vault-detail-receipt">
                <span className="vault-detail-section-label vault-detail-section-label--box">Blockchain Receipt</span>
                <DetailRow label="Contract" value="0x1aB…4cD2" href="#" />
                <DetailRow label="Token ID" value={`#${MOCK_CARD.tokenId}`} />
                <DetailRow label="TX Hash" value="0xf3a…91e2" href="#" />
                <TkButton decorative variant="subtle" size="sm" className="vault-detail-receipt__scan">
                  View on Polygonscan →
                </TkButton>
              </div>
              <div className="vault-detail-main-actions">
                <Link href="/portfolio" className="inline-flex w-full">
                  <TkButton decorative variant="primary" size="md" className="h-12 w-full justify-center text-[15px]">
                    View in Portfolio →
                  </TkButton>
                </Link>
                <Link href="/vault" className="inline-flex w-full">
                  <TkButton decorative variant="subtle" size="md" className="h-[42px] w-full justify-center text-[13px] text-white/50">
                    Back to Vault
                  </TkButton>
                </Link>
              </div>
            </>
          ) : null}
        </div>

        <aside className="vault-detail-aside">
          <div className="vault-card-box vault-detail-aside-image">
            <div className="vault-detail-aside-image__frame">
              <Image src={card.imageUrl} alt="" width={200} height={280} className="h-full w-full object-contain" />
            </div>
          </div>

          <div className="vault-card-box">
            <span className="vault-detail-section-label vault-detail-section-label--box">Card Details</span>
            <DetailRow label="Graded By" value={isRejected ? "PSA · 8" : "PSA · Gem Mint 10"} />
            <DetailRow label="Cert #" value={card.cert} />
            <DetailRow label="Vault" value="Delaware · Lloyd's" />
            {!isRejected ? (
              <>
                <DetailRow
                  label="Token"
                  value={
                    isCompleted ? (
                      <span className="font-mono text-[13px] font-bold text-[var(--azure)]">#{MOCK_CARD.tokenId}</span>
                    ) : (
                      <span className="text-[var(--amber)]">Pending…</span>
                    )
                  }
                />
                <DetailRow label="Status" value={isCompleted ? "Minted" : "Minting"} />
              </>
            ) : (
              <DetailRow label="Status" value={<span className="text-white/50">Not eligible</span>} />
            )}
          </div>

          {isRejected ? (
            <div className="vault-card-box">
              <span className="vault-detail-section-label vault-detail-section-label--box">What Happened</span>
              <p className="vault-detail-what-happened">
                We currently accept PSA 9 and PSA 10 graded cards. This card (PSA 8) doesn&apos;t meet the minimum grade.
                We&apos;ll return it to you shortly.
              </p>
            </div>
          ) : isCompleted ? (
            <div className="vault-card-box">
              <span className="vault-detail-section-label vault-detail-section-label--box">Blockchain Receipt</span>
              <DetailRow label="Contract" value="0x1aB…4cD2" href="#" />
              <DetailRow label="Token ID" value={`#${MOCK_CARD.tokenId}`} />
              <DetailRow label="TX Hash" value="0xf3a…91e2" href="#" />
              <TkButton decorative variant="subtle" size="sm" className="vault-detail-receipt__scan">
                View on Polygonscan →
              </TkButton>
            </div>
          ) : (
            <div className="vault-card-box vault-detail-receipt vault-detail-receipt--pending">
              <span className="vault-detail-section-label vault-detail-section-label--box vault-detail-section-label--muted">
                Blockchain Receipt
              </span>
              <div className="vault-detail-receipt__pending">
                <span className="vault-spin vault-detail-receipt__pending-spin" />
                <div>Awaiting mint confirmation…</div>
              </div>
            </div>
          )}

          <div className="vault-detail-aside-actions">
            {isRejected ? (
              <>
                <Link href="/vault/submit" className="inline-flex w-full">
                  <TkButton decorative variant="primary" size="md" className="h-12 w-full justify-center text-sm">
                    Submit Another Card →
                  </TkButton>
                </Link>
                <TkButton decorative variant="subtle" size="md" className="h-[42px] w-full justify-center text-[13px]">
                  Contact Support
                </TkButton>
              </>
            ) : isCompleted ? (
              <>
                <TkButton decorative variant="primary" size="md" className="h-12 w-full justify-center text-sm">
                  View on OpenSea →
                </TkButton>
                <TkButton decorative variant="subtle" size="md" className="h-[42px] w-full justify-center text-[13px]">
                  Download Receipt
                </TkButton>
                <TkButton decorative variant="subtle" size="md" className="h-[42px] w-full justify-center text-[13px]">
                  Request Card Delivery
                </TkButton>
                <TkButton decorative variant="subtle" size="md" className="h-[38px] w-full justify-center text-xs opacity-60">
                  Contact Support
                </TkButton>
              </>
            ) : (
              <>
                <TkButton
                  decorative
                  variant="primary"
                  size="md"
                  className="h-12 w-full justify-center text-sm opacity-40 cursor-not-allowed"
                  title="Available after minting completes"
                >
                  View on OpenSea →
                </TkButton>
                <TkButton decorative variant="subtle" size="md" className="h-[42px] w-full justify-center text-[13px]">
                  Download Receipt
                </TkButton>
                <TkButton decorative variant="subtle" size="md" className="h-[42px] w-full justify-center text-[13px]">
                  Request Card Delivery
                </TkButton>
                <TkButton decorative variant="subtle" size="md" className="h-[38px] w-full justify-center text-xs opacity-60">
                  Contact Support
                </TkButton>
              </>
            )}
          </div>

          <div className="vault-detail-delivery-note">
            <strong>{isRejected ? "Card Return" : "Card Delivery"}</strong>
            <br />
            {isRejected
              ? "Your card will be returned to the address on file. Return shipping costs are the submitter's responsibility. Please allow 7–10 business days for processing."
              : "Once a withdrawal request is submitted, processing time is generally 14–16 business days before shipment. This is an estimate and may vary depending on volume. After shipment, delivery times depend on the destination and carrier."}
          </div>
        </aside>
      </div>

      <VaultDemoToggle<DetailView>
        options={[
          { id: "minting", label: "Minting" },
          { id: "completed", label: "Completed" },
          { id: "rejected", label: "Rejected" },
        ]}
        value={view}
        onChange={setView}
      />
    </>
  );
}
