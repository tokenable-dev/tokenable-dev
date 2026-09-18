import type { VaultSubmissionApi, VaultSubmissionApiItem } from "@/lib/core/api/vault-submissions";
import {
  CARRIER_LABELS,
  CARRIER_TRACK_URLS,
  sellSubmissionAddTrackingHref,
  type SellCardDisplaySource,
  type SellCarrier,
} from "@/lib/sell/sellFlowDraft";
import { vaultSubmissionItemDisplaySource } from "@/lib/vault/vaultSubmissionDisplay";
import type { VaultHubReject, VaultHubRow, VaultHubVState } from "@/lib/vault/vaultHubTypes";

const OPEN_PACKAGE = new Set(["awaiting_shipment", "in_transit", "psa_reviewing"]);
const TERMINAL_ITEM = new Set(["rejected", "failed", "completed"]);
const ISSUE_ITEM = new Set(["rejected", "failed"]);

const REJECT_COPY: Record<string, Omit<VaultHubReject, "actionHref">> = {
  "cert-mismatch": {
    label: "Cert mismatch",
    exp: "The cert number didn’t match the PSA record for this slab.",
    actionLabel: "Arrange return",
  },
  "psa-declined": {
    label: "PSA declined",
    exp: "PSA didn’t accept it — ineligible, not a valid PSA slab, or suspected altered.",
    actionLabel: "Arrange return",
  },
  "grade-ineligible": {
    label: "Grade ineligible",
    exp: "The grade is below what we accept. PSA 9–10 only.",
    actionLabel: "Arrange return",
  },
  damaged: {
    label: "Damaged in transit",
    exp: "The slab arrived damaged during shipping.",
    actionLabel: "File a claim",
  },
  "not-received": {
    label: "Not received",
    exp: "It didn’t arrive by the expected deadline.",
    actionLabel: "Track shipment",
  },
};

function itemStatus(item: VaultSubmissionApiItem): string {
  return (item.status ?? "").trim().toLowerCase();
}

function formatGrade(grade: string | null | undefined): string {
  const g = grade?.trim();
  if (!g) return "—";
  if (/^psa\b/i.test(g)) return g;
  return `PSA ${g}`;
}

function formatDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOpenItem(item: VaultSubmissionApiItem): boolean {
  return !TERMINAL_ITEM.has(itemStatus(item));
}

function isIssueItem(item: VaultSubmissionApiItem): boolean {
  const status = itemStatus(item);
  if (ISSUE_ITEM.has(status)) return true;
  if (
    item.rejectionReason?.trim() &&
    status !== "completed" &&
    status !== "approved" &&
    status !== "minting"
  ) {
    return true;
  }
  return false;
}

function itemMeta(
  item: VaultSubmissionApiItem,
  enrichment?: Map<string, SellCardDisplaySource>,
) {
  const display = vaultSubmissionItemDisplaySource(
    item,
    enrichment?.get(item.cert),
  );
  return {
    ...display,
    name: display.name?.trim() || item.cert || "Card",
    grade: formatGrade(String(display.grade ?? item.grade)),
    cert: item.cert,
    imageUrl: item.imageUrl ?? "",
  };
}

function detailHref(publicId: string): string {
  return `/vault/submissions/${encodeURIComponent(publicId)}`;
}

function hasShipmentTracking(s: VaultSubmissionApi): boolean {
  return Boolean(s.trackingNumber?.trim());
}

function trackingHref(s: VaultSubmissionApi): string | undefined {
  const num = s.trackingNumber?.trim();
  if (!num) return undefined;
  const carrier = (s.carrier as SellCarrier) || "fedex";
  const base = CARRIER_TRACK_URLS[carrier] ?? CARRIER_TRACK_URLS.fedex;
  return `${base}${encodeURIComponent(num)}`;
}

function transitEta(s: VaultSubmissionApi): string {
  const shipped = formatDay(s.shipDate) || formatDay(s.shippedAt);
  const carrier = s.carrier
    ? (CARRIER_LABELS[s.carrier as SellCarrier] ?? s.carrier)
    : null;
  const parts: string[] = [];
  if (shipped) parts.push(`Shipped ${shipped}`);
  if (carrier && s.trackingNumber) parts.push(`${carrier} · ${s.trackingNumber}`);
  else if (s.trackingNumber) parts.push(s.trackingNumber);
  if (parts.length) return parts.join(" · ");
  return "";
}

function verifyEta(s: VaultSubmissionApi): string {
  const arrived = formatDay(s.updatedAt) || formatDay(s.shippedAt);
  if (arrived) return `Arrived ${arrived} · ~14–16 business days`;
  return "At PSA · ~14–16 business days";
}

function resolveReject(
  raw: string | null | undefined,
  failed: boolean,
  s: VaultSubmissionApi,
): VaultHubReject {
  const href = detailHref(s.publicId);
  const text = (raw ?? "").trim();
  const key = text.toLowerCase().replace(/\s+/g, "-");
  const fromCode = REJECT_COPY[key];
  if (fromCode) {
    const track = trackingHref(s);
    return {
      ...fromCode,
      actionHref: key === "not-received" && track ? track : href,
    };
  }

  const lower = text.toLowerCase();
  let code: keyof typeof REJECT_COPY | null = null;
  if (lower.includes("cert") && lower.includes("mismatch")) code = "cert-mismatch";
  else if (lower.includes("declined") || lower.includes("altered")) code = "psa-declined";
  else if (lower.includes("grade") || lower.includes("ineligible")) code = "grade-ineligible";
  else if (lower.includes("damag")) code = "damaged";
  else if (lower.includes("not received") || lower.includes("didn’t arrive") || lower.includes("didn't arrive")) {
    code = "not-received";
  }
  if (code) {
    const copy = REJECT_COPY[code];
    return { ...copy, actionHref: trackingHref(s) && code === "not-received" ? trackingHref(s)! : href };
  }

  return {
    label: failed ? "Failed" : "Rejected",
    exp:
      text ||
      (failed
        ? "Couldn’t be listed — contact support if this persists"
        : "The grade is below what we accept. PSA 9–10 only."),
    actionLabel: "View details",
    actionHref: href,
  };
}

function progressRows(
  s: VaultSubmissionApi,
  enrichment?: Map<string, SellCardDisplaySource>,
): VaultHubRow[] {
  const open = s.items.filter((i) => isOpenItem(i) && !isIssueItem(i));
  const cards = open.length > 0 ? open : s.items.length > 0 ? [s.items[0]] : [];
  const awaiting = s.status === "awaiting_shipment";
  const inTransit = s.status === "in_transit";
  const shipped = awaiting || inTransit;
  const hasTracking = hasShipmentTracking(s);

  return cards.map((item) => {
    const vstate: VaultHubVState = shipped ? "transit" : "verify";
    return {
      id: `${s.publicId}:${vstate}:${item.id}`,
      vstate,
      ...itemMeta(item, enrichment),
      eta: vstate === "transit" ? transitEta(s) : verifyEta(s),
      trackingUrl: shipped && hasTracking ? trackingHref(s) : undefined,
      addTrackingHref:
        shipped && !hasTracking
          ? sellSubmissionAddTrackingHref(s.publicId)
          : undefined,
      detailHref: detailHref(s.publicId),
    };
  });
}

function doneRow(
  s: VaultSubmissionApi,
  item: VaultSubmissionApiItem,
  enrichment?: Map<string, SellCardDisplaySource>,
): VaultHubRow {
  return {
    id: `${s.publicId}:done:${item.id}`,
    vstate: "vaulted",
    ...itemMeta(item, enrichment),
    detailHref: `/portfolio`,
  };
}

function rejectedRow(
  s: VaultSubmissionApi,
  item: VaultSubmissionApiItem,
  enrichment?: Map<string, SellCardDisplaySource>,
): VaultHubRow {
  const failed = itemStatus(item) === "failed";
  return {
    id: `${s.publicId}:rej:${item.id}`,
    vstate: "reject",
    ...itemMeta(item, enrichment),
    reject: resolveReject(item.rejectionReason, failed, s),
    detailHref: detailHref(s.publicId),
  };
}

function packageIssueRow(
  s: VaultSubmissionApi,
  enrichment?: Map<string, SellCardDisplaySource>,
): VaultHubRow {
  const card = s.items[0];
  const meta = card ? itemMeta(card, enrichment) : null;
  const allRejected = s.scenario === "F";
  return {
    id: `${s.publicId}:issue`,
    vstate: "reject",
    ...(meta ?? {
      name: "Submission",
      grade: "—",
      cert: "",
      imageUrl: "",
    }),
    reject: {
      label: allRejected ? "Rejected" : "Failed",
      exp: allRejected
        ? "Did not meet vault requirements"
        : "Something went wrong listing one or more cards",
      actionLabel: "View details",
      actionHref: detailHref(s.publicId),
    },
  };
}

function shouldShowProgressPackage(s: VaultSubmissionApi): boolean {
  if (s.status === "awaiting_shipment" || s.status === "in_transit") return true;
  if (s.status !== "psa_reviewing") return false;
  if (s.items.length > 0 && s.items.every((i) => !isOpenItem(i))) return false;
  return true;
}

const VSTATE_ORDER: Record<VaultHubVState, number> = {
  transit: 0,
  verify: 1,
  vaulted: 2,
  reject: 3,
};

export function buildVaultHubRowsFromSubmissions(
  submissions: VaultSubmissionApi[],
  enrichment?: Map<string, SellCardDisplaySource>,
): VaultHubRow[] {
  const rows: VaultHubRow[] = [];

  for (const s of submissions) {
    if (s.status === "cancelled" || s.status === "draft") continue;

    let issueCount = 0;
    for (const item of s.items) {
      if (isIssueItem(item)) {
        rows.push(rejectedRow(s, item, enrichment));
        issueCount += 1;
      }
      if (itemStatus(item) === "completed") rows.push(doneRow(s, item, enrichment));
    }

    if (issueCount === 0 && (s.scenario === "F" || s.scenario === "H")) {
      rows.push(packageIssueRow(s, enrichment));
    }

    if (shouldShowProgressPackage(s) && OPEN_PACKAGE.has(s.status)) {
      rows.push(...progressRows(s, enrichment));
    } else if (
      s.status === "completed" &&
      !s.items.some((i) => itemStatus(i) === "completed") &&
      issueCount === 0 &&
      s.scenario !== "F" &&
      s.scenario !== "H"
    ) {
      const first = s.items[0];
      if (first) rows.push(doneRow(s, first, enrichment));
    }
  }

  return rows.sort(
    (a, b) => VSTATE_ORDER[a.vstate] - VSTATE_ORDER[b.vstate] || a.name.localeCompare(b.name),
  );
}

/** True when the signed-in user has any non-cancelled vault submission. */
export function hasVaultHubActivityFromSubmissions(
  submissions: VaultSubmissionApi[],
): boolean {
  return submissions.some((s) => s.status !== "cancelled");
}

export function countVaultHubByState(rows: VaultHubRow[]) {
  const counts = {
    all: rows.length,
    transit: 0,
    verify: 0,
    vaulted: 0,
    reject: 0,
  };
  for (const r of rows) counts[r.vstate] += 1;
  return counts;
}
