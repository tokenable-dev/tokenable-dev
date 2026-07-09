"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { VaultBadge } from "@/components/vault/VaultBadge";
import {
  MOCK_HUB_STATS_ACTIVE,
  MOCK_IN_PROGRESS_ACTIVE,
  MOCK_SUBMISSION_HISTORY,
  type VaultInProgressItem,
} from "@/lib/vault/vaultMockData";
import { cn } from "@/lib/ds/cn";

function VaultIpGradeTag({ grade }: { grade: string }) {
  return <span className="vault-hub-grade-tag">{grade}</span>;
}

function VaultIpStatus({ item }: { item: VaultInProgressItem }) {
  const { statusKind, statusLabel, detail, grade } = item;

  if (statusKind === "token-sent") {
    return (
      <div className="vault-ip-card__status">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pos)" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span className="vault-ip-card__status-label vault-ip-card__status-label--pos">{statusLabel}</span>
        <VaultIpGradeTag grade={grade} />
      </div>
    );
  }

  const isAzure = statusKind === "in-transit" || statusKind === "minting";
  const dotClass = isAzure ? "vault-status-dot vault-status-dot--azure" : "vault-status-dot vault-status-dot--amber";
  const labelClass = isAzure
    ? "vault-ip-card__status-label vault-ip-card__status-label--azure"
    : "vault-ip-card__status-label vault-ip-card__status-label--amber";

  return (
    <div className="vault-ip-card__status">
      <span className={cn(dotClass, statusKind === "minting" && "vault-status-dot--pulse")} />
      <span className={labelClass}>{statusLabel}</span>
      {detail ? (
        <span className={statusKind === "in-transit" ? "vault-ip-card__detail" : "vault-ip-card__detail-text"}>
          {detail}
        </span>
      ) : null}
      <VaultIpGradeTag grade={grade} />
    </div>
  );
}

function VaultHubCtaLink({
  href,
  label,
  primary,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn("vault-hub-cta-link tk-btn tk-btn--sm", primary ? "tk-btn--primary" : "tk-btn--subtle")}
    >
      {label} →
    </Link>
  );
}

export function VaultDashboardView() {
  const inProgress = MOCK_IN_PROGRESS_ACTIVE;
  const historyCount = 10;
  const [query, setQuery] = useState("");

  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_SUBMISSION_HISTORY;
    return MOCK_SUBMISSION_HISTORY.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.cert.toLowerCase().includes(q) ||
        row.grade.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q),
    );
  }, [query]);

  const mobileHistory = filteredHistory;

  return (
    <div className="vault-hub-active">
      <div className="vault-hub-stat-grid">
        <div className="vault-hub-stat-card">
          <div className="vault-hub-stat-card__label">In Progress</div>
          <div className="vault-hub-stat-card__num vault-hub-stat-card__num--azure">
            {MOCK_HUB_STATS_ACTIVE.inProgress}
          </div>
          <div className="vault-hub-stat-card__sub">Submissions</div>
        </div>
        <div className="vault-hub-stat-card">
          <div className="vault-hub-stat-card__label">Completed</div>
          <div className="vault-hub-stat-card__num vault-hub-stat-card__num--pos">
            {MOCK_HUB_STATS_ACTIVE.completed}
          </div>
          <div className="vault-hub-stat-card__sub">Minted</div>
        </div>
        <div className="vault-hub-stat-card">
          <div className="vault-hub-stat-card__label">Rejected</div>
          <div className="vault-hub-stat-card__num vault-hub-stat-card__num--neg">
            {MOCK_HUB_STATS_ACTIVE.rejected}
          </div>
          <div className="vault-hub-stat-card__sub">Returned</div>
        </div>
      </div>

      <section className="vault-hub-section">
        <div className="vault-hub-sec-header">
          <div className="vault-hub-sec-title">
            In Progress <span className="vault-hub-sec-count">{inProgress.length}</span>
          </div>
        </div>
        <div className="vault-ip-grid">
          {inProgress.map((item) => (
            <div
              key={item.id}
              className={cn("vault-ip-card", item.actionNeeded && "vault-ip-card--action")}
            >
              <div className="vault-ip-card__top">
                <div className="vault-ip-card__thumb">
                  <Image src={item.imageUrl} alt="" width={50} height={72} />
                </div>
                <div className="vault-ip-card__info">
                  <div className="vault-ip-card__name">{item.name}</div>
                  <VaultIpStatus item={item} />
                  {item.hint ? <div className="vault-ip-card__hint vault-ip-card__hint--amber">{item.hint}</div> : null}
                </div>
              </div>
              <div className="vault-ip-card__bottom">
                <VaultHubCtaLink href={item.cta.href} label={item.cta.label} primary={item.cta.primary} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="vault-hub-section vault-hub-section--history">
        <div className="vault-hub-sec-header">
          <div className="vault-hub-sec-title">
            Submission History <span className="vault-hub-sec-count">{historyCount}</span>
          </div>
        </div>
        <div className="vault-hub-search-bar">
          <div className="vault-hub-search-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
            <input
              className="vault-hub-search-input"
              placeholder="Search submissions..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button type="button" className="vault-hub-filter-btn">
            Filter{" "}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        <div className="vault-hub-table-wrap">
          <table className="vault-hub-table">
            <thead>
              <tr>
                <th>Card</th>
                <th>Grade</th>
                <th>Cert #</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="vault-hub-table-card">
                      <div className="vault-hub-table-thumb">
                        <Image src={row.imageUrl} alt="" width={36} height={52} />
                      </div>
                      <div className="vault-hub-table-card__name">{row.name}</div>
                    </div>
                  </td>
                  <td>
                    <VaultBadge tone="grade">{row.grade}</VaultBadge>
                  </td>
                  <td>
                    <span className="vault-hub-mono vault-hub-mono--cert">{row.cert}</span>
                  </td>
                  <td>
                    <span className="vault-hub-mono vault-hub-mono--date">{row.submitted}</span>
                  </td>
                  <td>
                    <VaultBadge tone={row.status === "Minted" ? "vaulted" : "rejected"}>{row.status}</VaultBadge>
                  </td>
                  <td>
                    <Link href={row.href} className="vault-hub-cta-link vault-hub-cta-link--table tk-btn tk-btn--sm tk-btn--subtle">
                      View Log →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="vault-hub-mobile-list">
          {mobileHistory.map((row) => (
            <div key={row.id} className="vault-hub-mcard">
              <div className="vault-hub-mcard__top">
                <div className="vault-hub-table-thumb">
                  <Image src={row.imageUrl} alt="" width={36} height={52} />
                </div>
                <div className="vault-hub-mcard__body">
                  <div className="vault-hub-mcard__name">{row.name}</div>
                </div>
                <VaultBadge
                  tone={row.status === "Minted" ? "vaulted" : "rejected"}
                  className="vault-hub-mcard__badge"
                >
                  {row.status}
                </VaultBadge>
              </div>
              <div className="vault-hub-mcard__row">
                <span className="vault-hub-mcard__label">Submitted</span>
                <span className="vault-hub-mono vault-hub-mono--cert">{row.submitted}</span>
              </div>
              <div className="vault-hub-mcard__action">
                <Link href={row.href} className="vault-hub-cta-link vault-hub-cta-link--block tk-btn tk-btn--sm tk-btn--subtle">
                  View Log →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
