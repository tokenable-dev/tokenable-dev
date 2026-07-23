"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { VaultBadge } from "@/components/vault/VaultBadge";
import { VaultThumb } from "@/components/vault/VaultThumb";
import { TkTag } from "@/components/ds";
import {
  MOCK_DRAFT_SUBMISSION,
  MOCK_HUB_STATS_ACTIVE,
  MOCK_IN_PROGRESS_ACTIVE,
  MOCK_SUBMISSION_HISTORY,
  type VaultInProgressItem,
  type VaultSubmissionHistoryItem,
} from "@/lib/vault/vaultMockData";
import { cn } from "@/lib/ds/cn";

type HubTab = "progress" | "completed" | "rejected";

function VaultIpGradeTag({ grade }: { grade: string }) {
  return (
    <TkTag tone="neutral" appearance="soft" className="vault-hub-grade-tag">
      {grade}
    </TkTag>
  );
}

function VaultIpStatus({ item }: { item: VaultInProgressItem }) {
  const { statusKind, statusLabel, detail, grade, trackingUrl } = item;

  const isAzure = statusKind === "in-transit";
  const dotClass = isAzure ? "vault-status-dot vault-status-dot--azure" : "vault-status-dot vault-status-dot--amber";
  const labelClass = isAzure
    ? "vault-ip-card__status-label vault-ip-card__status-label--azure"
    : "vault-ip-card__status-label vault-ip-card__status-label--amber";

  return (
    <div className="vault-ip-card__status">
      <span className={dotClass} />
      <span className={labelClass}>{statusLabel}</span>
      {detail && trackingUrl ? (
        <a
          href={trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="vault-ip-card__tracking-link"
        >
          {detail} →
        </a>
      ) : detail ? (
        <span className="vault-ip-card__detail-text">{detail}</span>
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

function historyStatus(row: VaultSubmissionHistoryItem): "completed" | "rejected" {
  return row.status === "Rejected" ? "rejected" : "completed";
}

export function VaultDashboardView() {
  const inProgress = MOCK_IN_PROGRESS_ACTIVE;
  const [activeTab, setActiveTab] = useState<HubTab>("progress");
  const [query, setQuery] = useState("");

  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = MOCK_SUBMISSION_HISTORY.filter((row) => historyStatus(row) === activeTab);
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.cert.toLowerCase().includes(q) ||
        row.grade.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q),
    );
  }, [query, activeTab]);

  const showInProgress = activeTab === "progress";
  const showHistory = activeTab !== "progress";

  return (
    <div className="vault-hub-active">
      <div className="vault-hub-stat-grid">
        <button
          type="button"
          className={cn("vault-hub-stat-card vault-hub-stat-tab", activeTab === "progress" && "active")}
          onClick={() => setActiveTab("progress")}
        >
          <div className="vault-hub-stat-card__label">In Progress</div>
          <div className="vault-hub-stat-card__num vault-hub-stat-card__num--azure">
            {MOCK_HUB_STATS_ACTIVE.inProgress}
          </div>
          <div className="vault-hub-stat-card__sub">Submissions</div>
        </button>
        <button
          type="button"
          className={cn("vault-hub-stat-card vault-hub-stat-tab", activeTab === "completed" && "active")}
          onClick={() => setActiveTab("completed")}
        >
          <div className="vault-hub-stat-card__label">Completed</div>
          <div className="vault-hub-stat-card__num vault-hub-stat-card__num--pos">
            {MOCK_HUB_STATS_ACTIVE.completed}
          </div>
          <div className="vault-hub-stat-card__sub">Minted</div>
        </button>
        <button
          type="button"
          className={cn("vault-hub-stat-card vault-hub-stat-tab", activeTab === "rejected" && "active")}
          onClick={() => setActiveTab("rejected")}
        >
          <div className="vault-hub-stat-card__label">Rejected</div>
          <div className="vault-hub-stat-card__num vault-hub-stat-card__num--neg">
            {MOCK_HUB_STATS_ACTIVE.rejected}
          </div>
          <div className="vault-hub-stat-card__sub">Returned</div>
        </button>
      </div>

      {showInProgress ? (
        <section className="vault-hub-section">
          <div className="vault-hub-sec-header">
            <div className="vault-hub-sec-title">
              In Progress <span className="vault-hub-sec-count">{inProgress.length}</span>
            </div>
          </div>

          <div className="vault-draft-card">
            <div className="vault-draft-card__thumb">
              <VaultThumb src={MOCK_DRAFT_SUBMISSION.imageUrl} width={44} height={62} />
            </div>
            <div className="vault-draft-card__info">
              <div className="vault-draft-card__title">{MOCK_DRAFT_SUBMISSION.title}</div>
              <div className="vault-draft-card__meta">
                DRAFT · Saved {MOCK_DRAFT_SUBMISSION.savedAt}
              </div>
            </div>
            <div className="vault-draft-card__actions">
              <Link href={MOCK_DRAFT_SUBMISSION.href} className="vault-draft-card__resume tk-btn tk-btn--sm tk-btn--primary">
                Resume Submission →
              </Link>
              <button type="button" className="vault-draft-card__delete tk-btn tk-btn--sm tk-btn--subtle">
                Delete
              </button>
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
                    <VaultThumb src={item.imageUrl} width={50} height={72} />
                  </div>
                  <div className="vault-ip-card__info">
                    <div className="vault-ip-card__name">{item.name}</div>
                    <VaultIpStatus item={item} />
                    {item.hint ? (
                      <div className="vault-ip-card__hint vault-ip-card__hint--amber">{item.hint}</div>
                    ) : null}
                  </div>
                </div>
                <div className="vault-ip-card__bottom">
                  <VaultHubCtaLink href={item.cta.href} label={item.cta.label} primary={item.cta.primary} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {showHistory ? (
        <section className="vault-hub-section vault-hub-section--history">
          <div className="vault-hub-sec-header">
            <div className="vault-hub-sec-title">
              Submission History <span className="vault-hub-sec-count">{filteredHistory.length}</span>
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
                          <VaultThumb src={row.imageUrl} width={36} height={52} />
                        </div>
                        <div className="vault-hub-table-card__name">{row.name}</div>
                      </div>
                    </td>
                    <td>
                      <VaultBadge tone={row.status === "Rejected" ? "neutral" : "grade"}>{row.grade}</VaultBadge>
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
                      <Link
                        href={row.href}
                        className="vault-hub-cta-link vault-hub-cta-link--table tk-btn tk-btn--sm tk-btn--subtle"
                      >
                        View Log →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="vault-hub-mobile-list">
            {filteredHistory.map((row) => (
              <div key={row.id} className="vault-hub-mcard">
                <div className="vault-hub-mcard__top">
                  <div className="vault-hub-table-thumb">
                    <VaultThumb src={row.imageUrl} width={36} height={52} />
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
                  <Link
                    href={row.href}
                    className="vault-hub-cta-link vault-hub-cta-link--block tk-btn tk-btn--sm tk-btn--subtle"
                  >
                    View Log →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
