import type { VaultSubmissionApi, VaultSubmissionApiItem } from "@/lib/core/api/vault-submissions";
import {
  CARRIER_LABELS,
  CARRIER_TRACK_URLS,
  sellSubmissionResumeHref,
  type SellCarrier,
} from "@/lib/sell/sellFlowDraft";
import type { VaultHubRow } from "@/lib/vault/vaultHubTypes";

const OPEN_PACKAGE = new Set(["awaiting_shipment", "in_transit", "psa_reviewing"]);

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
  const openItems = s.items.filter(
    (i) => i.status !== "rejected" && i.status !== "failed" && i.status !== "completed",
  );
  const allReviewing =
    openItems.length > 0 && openItems.every((i) => i.status === "reviewing");
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
  return {
    id: `${s.publicId}:rej:${item.id}`,
    vstate: "rejected",
    ...itemMeta(item),
    gradeRejected: true,
    statusKind: "rejected",
    statusLabel: "Rejected",
    detail: item.rejectionReason?.trim() || "Grade not eligible (PSA 9/10 only)",
    cta: {
      label: "View",
      href: `/vault/submissions/${encodeURIComponent(s.publicId)}`,
      primary: false,
    },
  };
}

/** Map vault submissions → Sell hub rows (progress / done / rejected). */
export function buildVaultHubRowsFromSubmissions(
  submissions: VaultSubmissionApi[],
): VaultHubRow[] {
  const rows: VaultHubRow[] = [];

  for (const s of submissions) {
    if (s.status === "cancelled" || s.status === "draft") continue;

    for (const item of s.items) {
      if (item.status === "rejected") rows.push(rejectedRow(s, item));
      if (item.status === "completed") rows.push(doneRow(s, item));
    }

    if (OPEN_PACKAGE.has(s.status)) {
      rows.push(progressRow(s));
    } else if (
      s.status === "completed" &&
      !s.items.some((i) => i.status === "completed")
    ) {
      // Package completed without per-item completed flags — still show one done row.
      const first = s.items[0];
      if (first) rows.push(doneRow(s, first));
    }
  }

  return rows;
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
