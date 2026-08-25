import type { VaultSubmissionApi, VaultSubmissionApiItem } from "@/lib/core/api/vault-submissions";
import {
  CARRIER_LABELS,
  CARRIER_TRACK_URLS,
  sellSubmissionResumeHref,
  type SellCarrier,
} from "@/lib/sell/sellFlowDraft";
import type { VaultHubRow } from "@/lib/vault/vaultHubTypes";

const OPEN_PACKAGE = new Set(["awaiting_shipment", "in_transit", "psa_reviewing"]);
const TERMINAL_ITEM = new Set(["rejected", "failed", "completed"]);
/** Sell-process failures / admin rejects / mint issues → Rejected tab. */
const ISSUE_ITEM = new Set(["rejected", "failed"]);

function itemStatus(item: VaultSubmissionApiItem): string {
  return (item.status ?? "").trim().toLowerCase();
}

function formatGrade(grade: string | null | undefined): string {
  const g = grade?.trim();
  if (!g) return "—";
  if (/^psa\b/i.test(g)) return g;
  return `PSA ${g}`;
}

function packageMeta(items: VaultSubmissionApi["items"]) {
  const card = items[0];
  return {
    name: card?.name?.trim() || card?.cert || "Submission",
    grade: formatGrade(card?.grade),
    imageUrl: card?.imageUrl ?? "",
    cardCount: items.length,
  };
}

function itemMeta(item: VaultSubmissionApiItem) {
  return {
    name: item.name?.trim() || item.cert || "Card",
    grade: formatGrade(item.grade),
    imageUrl: item.imageUrl ?? "",
    cardCount: 1,
  };
}

function isOpenItem(item: VaultSubmissionApiItem): boolean {
  return !TERMINAL_ITEM.has(itemStatus(item));
}

function isIssueItem(item: VaultSubmissionApiItem): boolean {
  const status = itemStatus(item);
  if (ISSUE_ITEM.has(status)) return true;
  // Rejection reason without a successful completion → treat as issue.
  if (item.rejectionReason?.trim() && status !== "completed" && status !== "approved" && status !== "minting") {
    return true;
  }
  return false;
}

function progressRow(s: VaultSubmissionApi): VaultHubRow {
  const meta = packageMeta(s.items);
  const carrier = (s.carrier ?? "fedex") as SellCarrier;
  const resumeHref = sellSubmissionResumeHref(s.status, s.publicId);
  const detailHref = `/vault/submissions/${encodeURIComponent(s.publicId)}`;

  if (s.status === "awaiting_shipment") {
    return {
      id: s.publicId,
      vstate: "progress",
      ...meta,
      statusKind: "action-needed",
      statusLabel: "Shipping to vault",
      detail: "Tracking number required",
      actionNeeded: true,
      cta: { label: "Add tracking", href: resumeHref, primary: true },
    };
  }

  if (s.status === "in_transit") {
    return {
      id: s.publicId,
      vstate: "progress",
      ...meta,
      statusKind: "in-transit",
      statusLabel: "Shipping to vault",
      detail:
        s.trackingNumber && s.carrier
          ? `${CARRIER_LABELS[carrier] ?? s.carrier} · ${s.trackingNumber}`
          : undefined,
      trackingUrl:
        s.trackingNumber && s.carrier
          ? `${CARRIER_TRACK_URLS[carrier] ?? ""}${encodeURIComponent(s.trackingNumber)}`
          : undefined,
      cta: { label: "Track", href: detailHref, primary: false },
    };
  }

  // psa_reviewing — HTML splits Verifying vs PSA Review; prefer Verifying while
  // every open item is still "reviewing", else PSA Review.
  const openItems = s.items.filter(isOpenItem);
  const allReviewing =
    openItems.length > 0 && openItems.every((i) => itemStatus(i) === "reviewing");
  if (allReviewing) {
    return {
      id: s.publicId,
      vstate: "progress",
      ...meta,
      statusKind: "reviewing",
      statusLabel: "Verifying",
      detail: "Checking your card in",
      cta: { label: "View", href: detailHref, primary: false },
    };
  }

  return {
    id: s.publicId,
    vstate: "progress",
    ...meta,
    statusKind: "reviewing",
    statusLabel: "PSA Review",
    detail: "PSA is authenticating",
    cta: { label: "View", href: detailHref, primary: false },
  };
}

function doneRow(s: VaultSubmissionApi, item: VaultSubmissionApiItem): VaultHubRow {
  return {
    id: `${s.publicId}:done:${item.id}`,
    vstate: "done",
    ...itemMeta(item),
    statusKind: "token-sent",
    statusLabel: "Added to portfolio",
    detail: "Set a price in your portfolio to go live",
    cta: { label: "View in portfolio", href: "/portfolio", primary: false },
  };
}

function rejectedRow(s: VaultSubmissionApi, item: VaultSubmissionApiItem): VaultHubRow {
  const status = itemStatus(item);
  const failed = status === "failed";
  return {
    id: `${s.publicId}:rej:${item.id}`,
    vstate: "rejected",
    ...itemMeta(item),
    gradeRejected: true,
    statusKind: "rejected",
    statusLabel: failed ? "Failed" : "Rejected",
    detail:
      item.rejectionReason?.trim() ||
      (failed
        ? "Couldn’t be listed — contact support if this persists"
        : "Grade not eligible (PSA 9/10 only)"),
    cta: {
      label: "View",
      href: `/vault/submissions/${encodeURIComponent(s.publicId)}`,
      primary: false,
    },
  };
}

/** Package-level issue when scenario says F/H but items lack rejected/failed flags. */
function packageIssueRow(s: VaultSubmissionApi): VaultHubRow {
  const meta = packageMeta(s.items);
  const allRejected = s.scenario === "F";
  return {
    id: `${s.publicId}:issue`,
    vstate: "rejected",
    ...meta,
    gradeRejected: true,
    statusKind: "rejected",
    statusLabel: allRejected ? "Rejected" : "Failed",
    detail: allRejected
      ? "Did not meet vault requirements"
      : "Something went wrong listing one or more cards",
    cta: {
      label: "View",
      href: `/vault/submissions/${encodeURIComponent(s.publicId)}`,
      primary: false,
    },
  };
}

function shouldShowProgressPackage(s: VaultSubmissionApi): boolean {
  if (s.status === "awaiting_shipment" || s.status === "in_transit") return true;
  if (s.status !== "psa_reviewing") return false;
  // All cards terminal (e.g. all rejected) — show per-card rows only, not a phantom package.
  if (s.items.length > 0 && s.items.every((i) => !isOpenItem(i))) return false;
  return true;
}

const VSTATE_ORDER: Record<VaultHubRow["vstate"], number> = {
  self: 0,
  progress: 1,
  done: 2,
  rejected: 3,
};

/** Map vault submissions → Sell hub rows (progress / done / rejected). */
export function buildVaultHubRowsFromSubmissions(
  submissions: VaultSubmissionApi[],
): VaultHubRow[] {
  const rows: VaultHubRow[] = [];

  for (const s of submissions) {
    if (s.status === "cancelled" || s.status === "draft") continue;

    let issueCount = 0;
    for (const item of s.items) {
      if (isIssueItem(item)) {
        rows.push(rejectedRow(s, item));
        issueCount += 1;
      }
      if (itemStatus(item) === "completed") rows.push(doneRow(s, item));
    }

    // Scenario F (all rejected) / H (partial mint failure) without per-item flags.
    if (issueCount === 0 && (s.scenario === "F" || s.scenario === "H")) {
      rows.push(packageIssueRow(s));
    }

    if (shouldShowProgressPackage(s) && OPEN_PACKAGE.has(s.status)) {
      rows.push(progressRow(s));
    } else if (
      s.status === "completed" &&
      !s.items.some((i) => itemStatus(i) === "completed") &&
      issueCount === 0 &&
      s.scenario !== "F" &&
      s.scenario !== "H"
    ) {
      // Package completed without per-item flags — still show one done row.
      const first = s.items[0];
      if (first) rows.push(doneRow(s, first));
    }
  }

  // Match Vault-Dashboard-Active.html list order within the PSA block.
  return rows.sort(
    (a, b) => VSTATE_ORDER[a.vstate] - VSTATE_ORDER[b.vstate] || a.name.localeCompare(b.name),
  );
}

export function countVaultHubByState(rows: VaultHubRow[]) {
  const counts = {
    all: rows.length,
    self: 0,
    progress: 0,
    done: 0,
    rejected: 0,
  };
  for (const r of rows) counts[r.vstate] += 1;
  return counts;
}
