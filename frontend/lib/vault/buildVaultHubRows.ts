import type { VaultSubmissionApi, VaultSubmissionApiItem } from "@/lib/core/api/vault-submissions";
import {
  CARRIER_LABELS,
  CARRIER_TRACK_URLS,
  formatSellCardDisplay,
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

export type VaultHubPackageCard = {
  id: string;
  imageUrl: string;
  title: string;
  cert: string;
  state: VaultHubVState;
  statusLabel: string;
};

export type VaultHubPackage = {
  id: string;
  title: string;
  meta: string;
  /** Own line under meta on mobile (e.g. Cert #123). */
  certLine?: string;
  status: VaultHubVState;
  eta: string[];
  vaultedCount: number;
  rejectedCount: number;
  cards: VaultHubPackageCard[];
  actionLabel: string;
  actionHref: string;
  actionTone: "primary" | "subtle";
  actionExternal: boolean;
  /** Pre-ship only — owner can drop the package from Sell dashboard. */
  canCancel: boolean;
  detailHref: string;
  /** Carrier tracking page — linked from the eta tracking line (not the Track CTA). */
  trackingUrl?: string;
  createdAt: string;
};

const PACKAGE_STATUS_LABEL: Record<VaultHubVState, string> = {
  transit: "Shipped",
  verify: "Verifying",
  vaulted: "Vaulted",
  reject: "Rejected",
};

function packageStatus(s: VaultSubmissionApi): VaultHubVState {
  if (s.status === "awaiting_shipment" || s.status === "in_transit") return "transit";
  if (s.status === "psa_reviewing") return "verify";
  const rejected = s.items.filter((item) => isIssueItem(item)).length;
  const completed = s.items.filter((item) => itemStatus(item) === "completed").length;
  if (s.items.length > 0 && rejected === s.items.length) return "reject";
  if ((s.scenario === "F" || s.scenario === "H") && completed === 0) return "reject";
  if (s.status === "completed" || completed > 0) return "vaulted";
  if (rejected > 0) return "reject";
  return "verify";
}

function cardState(item: VaultSubmissionApiItem, pkg: VaultHubVState): VaultHubVState {
  if (isIssueItem(item)) return "reject";
  if (itemStatus(item) === "completed") return "vaulted";
  if (pkg === "transit") return "transit";
  if (pkg === "reject") return "reject";
  return "verify";
}

function packageEta(s: VaultSubmissionApi, status: VaultHubVState, rejectLabel: string): string[] {
  if (status === "transit") {
    const shipped = formatDay(s.shipDate) || formatDay(s.shippedAt) || formatDay(s.createdAt);
    const tracking = s.trackingNumber?.trim();
    if (tracking) {
      const carrier = s.carrier
        ? (CARRIER_LABELS[s.carrier as SellCarrier] ?? s.carrier)
        : null;
      return [
        shipped ? `Shipped ${shipped}` : "Shipped",
        carrier ? `${carrier} · ${tracking}` : tracking,
      ];
    }
    return [shipped ? `Packed ${shipped}` : "Ready to ship", "Add tracking"];
  }
  if (status === "verify") {
    const arrived = formatDay(s.updatedAt) || formatDay(s.shippedAt);
    return [arrived ? `Arrived ${arrived}` : "At PSA", "~14–16 business days"];
  }
  if (status === "vaulted") {
    const day = formatDay(s.updatedAt);
    return [day ? `Vaulted ${day}` : "Vaulted", "Tokens minted to Collection"];
  }
  return ["Rejected", rejectLabel || "Needs attention"];
}

/** One row per submission — Vault-Dashboard-Active.html. */
export function buildVaultHubPackages(
  submissions: VaultSubmissionApi[],
  enrichment?: Map<string, SellCardDisplaySource>,
): VaultHubPackage[] {
  const packages: VaultHubPackage[] = [];

  for (const s of submissions) {
    if (s.status === "cancelled" || s.status === "draft") continue;
    const status = packageStatus(s);
    const href = detailHref(s.publicId);
    const cards: VaultHubPackageCard[] = s.items.map((item) => {
      const display = itemMeta(item, enrichment);
      const { line1 } = formatSellCardDisplay(display);
      const state = cardState(item, status);
      const reject =
        state === "reject" ? resolveReject(item.rejectionReason, itemStatus(item) === "failed", s) : null;
      return {
        id: item.id,
        imageUrl: display.imageUrl,
        title: line1 || display.name,
        cert: display.cert,
        state,
        statusLabel: reject?.label ?? PACKAGE_STATUS_LABEL[state],
      };
    });
    const first = cards[0];
    const firstDisplay = s.items[0] ? formatSellCardDisplay(itemMeta(s.items[0], enrichment)) : null;
    const title =
      cards.length === 1 && first
        ? first.title
        : `Submission · ${formatDay(s.createdAt) ?? "package"}`;
    const certLine =
      cards.length === 1 && first?.cert ? `Cert #${first.cert}` : undefined;
    const meta =
      cards.length === 1 && first
        ? ["1 card", firstDisplay?.line2].filter(Boolean).join(" · ")
        : `${cards.length} cards`;
    const tracked = hasShipmentTracking(s);
    const trackUrl = trackingHref(s);
    const rejectLabel = cards.find((c) => c.state === "reject")?.statusLabel ?? "";
    let actionLabel = "View";
    let actionHref = href;
    let actionTone: VaultHubPackage["actionTone"] = "subtle";
    let actionExternal = false;
    if (status === "transit" && !tracked) {
      actionLabel = "Add tracking";
      actionHref = sellSubmissionAddTrackingHref(s.publicId);
      actionTone = "primary";
    } else if (status === "transit" && tracked) {
      // Track CTA → submission detail (In Transit). Carrier link lives on the eta line.
      actionLabel = "Track →";
      actionHref = href;
      actionExternal = false;
    } else if (status === "vaulted") {
      actionHref = "/portfolio";
    } else if (status === "reject") {
      actionLabel = "Contact support";
      actionHref = "mailto:dev@tokenable.io";
      actionTone = "primary";
    }

    packages.push({
      id: s.publicId,
      title,
      meta,
      certLine,
      status,
      eta: packageEta(s, status, rejectLabel),
      vaultedCount: cards.filter((c) => c.state === "vaulted").length,
      rejectedCount: cards.filter((c) => c.state === "reject").length,
      cards,
      canCancel: s.status === "awaiting_shipment" && !tracked,
      actionLabel,
      actionHref,
      actionTone,
      actionExternal,
      detailHref: href,
      trackingUrl: status === "transit" ? trackUrl : undefined,
      createdAt: s.createdAt,
    });
  }

  return packages.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function packageMatchesTab(
  pkg: VaultHubPackage,
  tab: "all" | VaultHubVState,
): boolean {
  if (tab === "all") return true;
  if (tab === "reject") return pkg.status === "reject" || pkg.rejectedCount > 0;
  return pkg.status === tab;
}

export function countVaultHubPackages(packages: VaultHubPackage[]) {
  const tabs = ["all", "transit", "verify", "vaulted", "reject"] as const;
  return Object.fromEntries(
    tabs.map((tab) => [tab, packages.filter((pkg) => packageMatchesTab(pkg, tab)).length]),
  ) as Record<(typeof tabs)[number], number>;
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
