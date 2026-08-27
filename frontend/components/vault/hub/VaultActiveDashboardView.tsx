"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { VaultThumb } from "@/components/vault/VaultThumb";
import { listVaultSubmissions } from "@/lib/core/api/vault-submissions";
import { rq } from "@/lib/core";
import { useAuthStore } from "@/store/authStore";
import {
  buildVaultHubRowsFromSubmissions,
  countVaultHubByState,
} from "@/lib/vault/buildVaultHubRows";
import type { VaultHubRow, VaultHubVState } from "@/lib/vault/vaultHubTypes";
import { cn } from "@/lib/ds/cn";

type TabFilter = "all" | VaultHubVState;

const TABS: { id: TabFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "transit", label: "In transit" },
  { id: "verify", label: "Verifying" },
  { id: "vaulted", label: "Vaulted" },
  { id: "reject", label: "Rejected" },
];

const STEPS = ["In transit", "Verifying", "Vaulted"] as const;
const STEP_IDX: Record<Exclude<VaultHubVState, "reject">, number> = {
  transit: 0,
  verify: 1,
  vaulted: 2,
};

function RejectChip() {
  return (
    <span className="vault-v-chip vault-v-chip--reject">
      <span className="vault-v-chip__dot" />
      Rejected
    </span>
  );
}

function Steps({ status }: { status: VaultHubVState }) {
  const cur = status === "reject" ? 1 : STEP_IDX[status];
  return (
    <div className="vault-v-steps">
      {STEPS.map((label, i) => {
        const cls = i < cur ? "done" : i === cur ? "current" : "";
        const mark = i < cur ? "✓" : String(i + 1);
        return (
          <div key={label} className={cn("vault-v-step", cls && `vault-v-step--${cls}`)}>
            <span className="vault-v-step__dot">{mark}</span>
            <span className="vault-v-step__lbl">{label}</span>
            {i < STEPS.length - 1 ? <span className="vault-v-step__bar" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function HubCard({ item }: { item: VaultHubRow }) {
  const reject = item.vstate === "reject" && item.reject;
  return (
    <div className={cn("vault-v-card", reject && "vault-v-card--reject")}>
      <div className="vault-v-card__body">
        <div className="vault-v-thumb">
          <VaultThumb src={item.imageUrl} width={54} height={80} />
        </div>
        <div className="vault-v-info">
          <div className="vault-v-name-row">
            <div className="vault-v-name">{item.name}</div>
            {reject ? <RejectChip /> : null}
          </div>
          <div className="vault-v-meta">
            <span className="vault-v-grade">{item.grade}</span>
            {item.cert ? (
              <span className="vault-v-cert tkl-mono">Cert #{item.cert}</span>
            ) : null}
          </div>
          {reject ? (
            <div className="vault-v-reject-box">
              <span className="vault-v-reason-tag">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="13" />
                  <line x1="12" y1="16.5" x2="12" y2="16.5" />
                </svg>
                Reason · {item.reject!.label}
              </span>
              <p className="vault-v-reason-exp">{item.reject!.exp}</p>
              <div className="vault-v-actions">
                <Link href={item.reject!.actionHref} className="tk-btn tk-btn--primary">
                  {item.reject!.actionLabel}
                </Link>
                <a href="mailto:dev@tokenable.io" className="tk-btn tk-btn--subtle">
                  Contact support
                </a>
              </div>
            </div>
          ) : (
            <>
              <Steps status={item.vstate} />
              {item.vstate === "vaulted" ? (
                <div className="vault-v-note">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>
                    Verified and moved to your{" "}
                    <Link href="/portfolio">Portfolio</Link> — drops off this page shortly.
                  </span>
                </div>
              ) : (
                <div className="vault-v-eta">
                  {item.trackingUrl && item.eta ? (
                    <a href={item.trackingUrl} target="_blank" rel="noopener noreferrer">
                      {item.eta}
                    </a>
                  ) : (
                    item.eta
                  )}
                  {item.addTrackingHref ? (
                    <>
                      {" · "}
                      <Link href={item.addTrackingHref}>Add tracking</Link>
                    </>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Vault-Dashboard-Active.html — status tabs + per-card list. */
export function VaultActiveDashboardView() {
  const [filter, setFilter] = useState<TabFilter>("all");

  const submissionsQ = useQuery({
    queryKey: rq.vaultSubmissions(),
    queryFn: listVaultSubmissions,
    staleTime: 10_000,
  });

  const allRows = useMemo(
    () => buildVaultHubRowsFromSubmissions(submissionsQ.data ?? []),
    [submissionsQ.data],
  );

  const counts = useMemo(() => countVaultHubByState(allRows), [allRows]);

  const visible = filter === "all" ? allRows : allRows.filter((r) => r.vstate === filter);

  if (submissionsQ.isLoading && allRows.length === 0) {
    return (
      <div className="vault-hub-active vault-hub-active--loading" aria-busy>
        <div className="vault-hub-active__skel" />
        <div className="vault-hub-active__skel" />
      </div>
    );
  }

  return (
    <div className="vault-hub-active">
      <p className="vault-hub-legend">
        Once <strong>vaulted</strong>, a card moves to your <strong>Portfolio</strong> and leaves
        this page. <strong>Rejected</strong> cards stay here until you resolve them. Partner-vault
        (instant) cards skip vaulting and go straight to Portfolio. Full record is always in your{" "}
        <Link href="/portfolio">transaction history</Link>.
      </p>

      <div className="vault-vtabs" role="tablist" aria-label="Vaulting status">
        {TABS.map((t) => {
          const on = filter === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={cn("vault-vtab", on && "vault-vtab--on")}
              onClick={() => setFilter(t.id)}
            >
              {t.label}
              <span className="vault-vtab__n">{counts[t.id]}</span>
            </button>
          );
        })}
      </div>

      {visible.length > 0 ? (
        <div className="vault-v-list">
          {visible.map((item) => (
            <HubCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="vault-v-empty">Nothing in this state right now.</div>
      )}
    </div>
  );
}

/** True when the signed-in user has any PSA vaulting activity on this hub. */
export function useHasVaultHubActivity(): boolean {
  const user = useAuthStore((s) => s.user);

  const submissionsQ = useQuery({
    queryKey: rq.vaultSubmissions(),
    queryFn: listVaultSubmissions,
    staleTime: 10_000,
    enabled: Boolean(user),
  });

  return useMemo(
    () => buildVaultHubRowsFromSubmissions(submissionsQ.data ?? []).length > 0,
    [submissionsQ.data],
  );
}
