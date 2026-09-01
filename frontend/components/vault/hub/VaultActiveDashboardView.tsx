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
import { TkStepper } from "@/components/ds";
import { cn } from "@/lib/ds/cn";

type TabFilter = "all" | VaultHubVState;

const TABS: { id: TabFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "transit", label: "Shipped" },
  { id: "verify", label: "Verifying" },
  { id: "vaulted", label: "Vaulted" },
  { id: "reject", label: "Rejected" },
];

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

function hubStepperSteps(status: Exclude<VaultHubVState, "reject">) {
  const labels = ["Shipped", "Verifying", "Vaulted"] as const;
  const idx = STEP_IDX[status];
  return labels.map((label, i) => ({
    label,
    state:
      status === "vaulted"
        ? ("done" as const)
        : i < idx
          ? ("done" as const)
          : i === idx
            ? ("current" as const)
            : ("todo" as const),
  }));
}

function HubCardAction({ item }: { item: VaultHubRow }) {
  const s = "vault-v-side-btn";
  if (item.vstate === "reject") return null;
  if (item.vstate === "transit" && item.addTrackingHref) {
    return (
      <Link href={item.addTrackingHref} className={`tk-btn tk-btn--primary ${s}`}>
        Add tracking
      </Link>
    );
  }
  if (item.vstate === "transit" && item.trackingUrl) {
    return (
      <a
        href={item.trackingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`tk-btn tk-btn--subtle ${s}`}
      >
        Track →
      </a>
    );
  }
  if (item.vstate === "verify" && item.detailHref) {
    return (
      <Link href={item.detailHref} className={`tk-btn tk-btn--subtle ${s}`}>
        View
      </Link>
    );
  }
  if (item.vstate === "vaulted") {
    return (
      <Link href="/portfolio" className={`tk-btn tk-btn--subtle ${s}`}>
        View in portfolio
      </Link>
    );
  }
  return null;
}

function HubCard({ item }: { item: VaultHubRow }) {
  const reject = item.vstate === "reject" && item.reject;
  const nameWithGrade = [item.name, item.grade].filter(Boolean).join(" · ");
  const certLine = item.cert ? `Cert #${item.cert}` : null;
  return (
    <div className={cn("vault-v-card", reject && "vault-v-card--reject")}>
      <div className="vault-v-card__body">
        <div className="vault-v-thumb">
          <VaultThumb src={item.imageUrl} width={54} height={80} />
        </div>
        <div className="vault-v-info">
          <div className="vault-v-name-row">
            <div className="vault-v-name-block">
              <div className="vault-v-name">{nameWithGrade}</div>
              {certLine ? <div className="vault-v-cert">{certLine}</div> : null}
            </div>
            <div className="vault-v-card__side">
              {reject ? <RejectChip /> : <HubCardAction item={item} />}
              {reject ? (
                <>
                  <Link href={item.reject!.actionHref} className="tk-btn tk-btn--primary vault-v-side-btn vault-v-side-btn--sm">
                    {item.reject!.actionLabel}
                  </Link>
                  <a href="mailto:dev@tokenable.io" className="tk-btn tk-btn--subtle vault-v-side-btn vault-v-side-btn--sm">
                    Contact support
                  </a>
                </>
              ) : null}
            </div>
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
            </div>
          ) : (
            <>
              <div className="vault-v-stepper">
                <TkStepper
                  theme="dark"
                  size="sm"
                  aria-label="Vaulting progress"
                  steps={hubStepperSteps(item.vstate as Exclude<VaultHubVState, "reject">)}
                />
              </div>
              {item.vstate === "vaulted" ? (
                <div className="vault-v-note">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>
                    Token minted to your{" "}
                    <Link href="/portfolio">Portfolio</Link>.
                  </span>
                </div>
              ) : item.eta ? (
                <div className="vault-v-eta">{item.eta}</div>
              ) : null}
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
