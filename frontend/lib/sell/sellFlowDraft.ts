import {
  formatCardDisplayName,
  joinCardDisplaySegments,
} from "@/lib/marketplace/cardDisplayName";
import type { PsaAnalyzeResult } from "@/lib/core";

export type SellCardDisplaySource = {
  cert?: string | null;
  name?: string | null;
  grade?: number | string | null;
  cardNumber?: string | null;
  year?: string | null;
  setName?: string | null;
  language?: string | null;
  variant?: string | null;
};

function resolveSellCardGrade(
  grade: number | string | null | undefined,
): string | null {
  if (grade == null) return null;
  if (typeof grade === "number") return `PSA ${grade}`;
  const g = grade.trim();
  if (!g) return null;
  if (/^psa\b/i.test(g)) return g;
  return `PSA ${g}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanPsaCardName(raw: string): string {
  return raw
    .replace(/\bPSA\/?DNA\b/gi, " ")
    .replace(/\bDNA\b/gi, " ")
    .replace(/\bAUTOGRAPH(?:ED)?\b/gi, " ")
    .replace(/\bSIGNED\b/gi, " ")
    .replace(/\bAUTO\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** When cardNameHint is still a full catalog line, peel known year/set/# tokens. */
function stripEmbeddedPsaIdentityFromName(
  name: string,
  parts: Pick<SellCardDisplaySource, "year" | "setName" | "cardNumber">,
): string {
  let out = name.trim();
  const year = parts.year?.trim();
  const setName = parts.setName?.trim();
  const cardNumber = parts.cardNumber?.trim()?.replace(/^#/, "");

  if (year && out.toLowerCase().startsWith(year.toLowerCase())) {
    out = out.slice(year.length).trim();
  }
  if (setName) {
    const re = new RegExp(`^${escapeRegExp(setName)}\\b`, "i");
    out = out.replace(re, "").trim();
  }
  if (cardNumber) {
    out = out
      .replace(new RegExp(`^#?${escapeRegExp(cardNumber)}\\b`, "i"), "")
      .trim();
  }

  return out;
}

/** Sports-style PSA catalog line stored only in `name` (legacy drafts). */
function parseLegacyPsaCatalogLine(
  line: string,
): Partial<SellCardDisplaySource> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})\s+(.+?)\s+#([A-Za-z0-9/.-]+)\s+(.+)$/i.exec(trimmed);
  if (!match) return null;
  return {
    year: match[1],
    setName: match[2]?.trim() || null,
    cardNumber: match[3]?.trim() || null,
    name: cleanPsaCardName(match[4] ?? ""),
  };
}

/** Map PSA analyze → SSOT display fields for sell draft cards. */
export function sellDraftCardFieldsFromPsaAnalyze(
  r: PsaAnalyzeResult,
): Pick<
  SellDraftCard,
  "name" | "cardNumber" | "year" | "setName" | "language" | "variant"
> {
  const psa = r.psa;
  const base = r.identity?.base_card;

  const cardNumber =
    base?.card_number?.trim() ||
    psa.cardNumberHint?.trim()?.replace(/^#/, "") ||
    null;
  const year = base?.year?.trim() || psa.year?.trim() || null;
  const setName = base?.set?.trim() || psa.setHint?.trim() || null;
  const variant = psa.varietyHint?.trim() || null;

  let name = cleanPsaCardName(
    base?.card_name?.trim() || psa.cardNameHint?.trim() || "",
  );
  if (name && (year || setName || cardNumber)) {
    const stripped = stripEmbeddedPsaIdentityFromName(name, {
      year,
      setName,
      cardNumber,
    });
    if (stripped) name = cleanPsaCardName(stripped);
  }

  const cert = psa.certNumber?.trim();
  return {
    name: name || (cert ? `PSA CERT #${cert}` : "PSA GRADED CARD"),
    cardNumber,
    year,
    setName,
    variant,
    language: null,
  };
}

/** Normalize legacy sell cards before SSOT formatting. */
export function normalizeSellCardDisplaySource(
  source: SellCardDisplaySource,
): SellCardDisplaySource {
  const hasStructure =
    Boolean(source.cardNumber?.trim()) ||
    Boolean(source.year?.trim()) ||
    Boolean(source.setName?.trim()) ||
    Boolean(source.variant?.trim());

  if (hasStructure) {
    const cleanedName = cleanPsaCardName(source.name ?? "");
    const name =
      stripEmbeddedPsaIdentityFromName(cleanedName, source) || cleanedName;
    return { ...source, name };
  }

  const parsed = parseLegacyPsaCatalogLine(source.name ?? "");
  if (parsed) {
    return {
      ...source,
      ...parsed,
      name: parsed.name ?? source.name ?? null,
    };
  }

  return source;
}

/** Line 1 + Line 2 per docs/guides/card-display-name.md (Sell / Vault surfaces). */
export function formatSellCardDisplay(
  source: SellCardDisplaySource,
  opts?: { certOnLine2?: boolean },
): { line1: string; line2: string | null } {
  const normalized = normalizeSellCardDisplaySource(source);
  const { line1, line2 } = formatCardDisplayName(
    {
      cardName: normalized.name ?? null,
      cardNumber: normalized.cardNumber ?? null,
      grade: resolveSellCardGrade(normalized.grade),
      year: normalized.year ?? null,
      setName: normalized.setName ?? null,
      language: normalized.language ?? null,
      variant: normalized.variant ?? null,
    },
    { mode: "line1+line2" },
  );

  const cert = source.cert?.trim();
  if (opts?.certOnLine2 && cert) {
    const certLabel = `Cert #${cert}`;
    return {
      line1,
      line2: line2
        ? joinCardDisplaySegments([line2, certLabel])
        : certLabel,
    };
  }

  return { line1, line2: line2 || null };
}

export type SellDraftCard = {
  cert: string;
  name: string;
  grade: number;
  img: string | null;
  confirmed: boolean;
  cardNumber?: string | null;
  year?: string | null;
  setName?: string | null;
  language?: string | null;
  variant?: string | null;
};

export const SELL_FLOW_DRAFT_KEY = "tk_sell_flow_draft";
export const SELL_SHIPMENT_KEY = "tk_sell_shipment";
/** Server-backed submission public id (SUB-…) after shipping upsert. */
export const SELL_SUBMISSION_PUBLIC_ID_KEY = "tk_sell_submission_public_id";
/** In-progress UI step + shipping form fields (survives refresh / tab close). Card drafts are local-only until shipping. */
export const SELL_FLOW_PROGRESS_KEY = "tk_sell_flow_progress";
/** Which Tokenable user owns the current browser sell draft (prevents cross-account leaks). */
const SELL_FLOW_OWNER_KEY = "tk_sell_flow_owner";
/** Bump only to drop offline-only fake In Transit shipments (not card drafts). */
const SELL_LOCAL_SCHEMA_KEY = "tk_sell_local_schema";
/** 6 — clear stale SUB-… after draft packages stopped being created server-side. */
const SELL_LOCAL_SCHEMA = "6";

/** Wipe browser-only sell progress (not server DB). Safe to call often. */
export function clearAllSellLocalState() {
  try {
    localStorage.removeItem(SELL_FLOW_DRAFT_KEY);
    localStorage.removeItem(SELL_FLOW_PROGRESS_KEY);
    localStorage.removeItem(SELL_SHIPMENT_KEY);
    localStorage.removeItem(SELL_SUBMISSION_PUBLIC_ID_KEY);
    localStorage.removeItem(SELL_FLOW_OWNER_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Bind local sell draft keys to the signed-in user.
 * Returns true when storage was cleared (account switch / logout / legacy orphan).
 */
export function bindSellFlowToUser(userId: string | null | undefined): boolean {
  if (typeof window === "undefined") return false;
  try {
    const next = userId?.trim() || "";
    const prev = localStorage.getItem(SELL_FLOW_OWNER_KEY)?.trim() || "";
    if (!next) {
      const hadData =
        Boolean(prev) ||
        Boolean(localStorage.getItem(SELL_FLOW_DRAFT_KEY)) ||
        Boolean(localStorage.getItem(SELL_FLOW_PROGRESS_KEY)) ||
        Boolean(localStorage.getItem(SELL_SUBMISSION_PUBLIC_ID_KEY));
      if (hadData) clearAllSellLocalState();
      return hadData;
    }
    if (prev === next) return false;
    // Different account, or legacy unscoped draft with no owner — start clean.
    clearAllSellLocalState();
    localStorage.setItem(SELL_FLOW_OWNER_KEY, next);
    return true;
  } catch {
    return false;
  }
}

function ensureSellLocalSchema() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(SELL_LOCAL_SCHEMA_KEY) === SELL_LOCAL_SCHEMA) return;
    // Drop offline-confirmed shipment mocks + stale package ids pointing at cancelled drafts.
    localStorage.removeItem(SELL_SHIPMENT_KEY);
    localStorage.removeItem(SELL_SUBMISSION_PUBLIC_ID_KEY);
    localStorage.setItem(SELL_LOCAL_SCHEMA_KEY, SELL_LOCAL_SCHEMA);
  } catch {
    /* ignore */
  }
}

export type SellFlowStep =
  | "register"
  | "vault"
  | "self-mint"
  | "cards"
  | "shipping-pack"
  | "shipping-track";

/** Sell-Flow / Choose-Vault — how the seller will list cards. */
export type SellVaultChoice = "self" | "psa";

export type SellCarrier = "fedex" | "dhl" | "ups";

/** Local-only PSA return address draft (not yet sent to PSA intake APIs). */
export type SellReturnAddressDraft = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postal: string;
  /** ISO-ish country key used by the form select. */
  country: string;
  phone: string;
};

export type SellFlowProgress = {
  step: SellFlowStep;
  /** Set on the Choose a vault screen (null until picked). */
  vaultChoice: SellVaultChoice | null;
  checklist: boolean[];
  slipDownloaded: boolean;
  carrier: SellCarrier;
  shipDate: string;
  trackingNumber: string;
  returnAddress: SellReturnAddressDraft;
  updatedAt: string;
};

export const PSA_SHIP_TO = {
  name: "TOKENABLE LIMITED (107038975)",
  lines: [
    "600 SHIPS LANDING WAY",
    "NEW CASTLE, DE 19720",
    "United States",
  ],
} as const;

export const PSA_SHIP_TO_PLAIN = [PSA_SHIP_TO.name, ...PSA_SHIP_TO.lines].join("\n");

/** Packing checklist — PSA-Shipping.html / useSellShipping. */
export const PSA_PACK_CHECKLIST = [
  "Wrap slab in an individual plastic sleeve",
  "Place thick cardboard on both sides, secure with rubber band",
  "Wrap in bubble wrap at least 2–3 times",
  "Fill all empty box space with packing material",
  "Include the Packing Slip inside the box — required",
] as const;

function emptyChecklist(): boolean[] {
  return Array.from({ length: PSA_PACK_CHECKLIST.length }, () => false);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function emptySellReturnAddress(): SellReturnAddressDraft {
  return {
    name: "",
    line1: "",
    line2: "",
    city: "",
    region: "",
    postal: "",
    country: "",
    phone: "",
  };
}

/** Required fields for PSA return address (PSA-Shipping.html returnAddrValid). */
export function isSellReturnAddressComplete(addr: SellReturnAddressDraft): boolean {
  return (
    addr.name.trim().length > 0 &&
    addr.line1.trim().length > 0 &&
    addr.city.trim().length > 0 &&
    addr.region.trim().length > 0 &&
    addr.postal.trim().length > 0 &&
    addr.country.trim().length > 0 &&
    addr.phone.trim().length > 0
  );
}

export function formatSellReturnAddressSummary(addr: SellReturnAddressDraft): string {
  const line = [addr.line1.trim(), addr.line2.trim()].filter(Boolean).join(", ");
  const cityLine = [addr.city.trim(), addr.region.trim(), addr.postal.trim()]
    .filter(Boolean)
    .join(", ");
  const parts = [addr.name.trim(), line, cityLine].filter(Boolean);
  return parts.join(" · ");
}

function parseReturnAddress(raw: unknown): SellReturnAddressDraft {
  const empty = emptySellReturnAddress();
  if (!raw || typeof raw !== "object") return empty;
  const o = raw as Record<string, unknown>;
  const str = (key: keyof SellReturnAddressDraft) =>
    typeof o[key] === "string" ? (o[key] as string) : empty[key];
  return {
    name: str("name"),
    line1: str("line1"),
    line2: str("line2"),
    city: str("city"),
    region: str("region"),
    postal: str("postal"),
    country: str("country") || "us",
    phone: str("phone"),
  };
}

export function defaultSellFlowProgress(
  overrides?: Partial<SellFlowProgress>,
): SellFlowProgress {
  return {
    step: "register",
    vaultChoice: null,
    checklist: emptyChecklist(),
    slipDownloaded: false,
    carrier: "fedex",
    shipDate: todayIsoDate(),
    trackingNumber: "",
    returnAddress: emptySellReturnAddress(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function readSellFlowDraftCards(): SellDraftCard[] {
  ensureSellLocalSchema();
  try {
    const raw = localStorage.getItem(SELL_FLOW_DRAFT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SellDraftCard[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((card) => {
      const normalized = normalizeSellCardDisplaySource(card);
      return {
        ...card,
        name: normalized.name ?? card.name,
        cardNumber: normalized.cardNumber ?? card.cardNumber,
        year: normalized.year ?? card.year,
        setName: normalized.setName ?? card.setName,
        variant: normalized.variant ?? card.variant,
        language: normalized.language ?? card.language,
      };
    });
  } catch {
    return [];
  }
}

export function writeSellFlowDraftCards(cards: SellDraftCard[]) {
  try {
    localStorage.setItem(SELL_FLOW_DRAFT_KEY, JSON.stringify(cards));
  } catch {
    /* ignore */
  }
}

export function readSellFlowProgress(): SellFlowProgress {
  ensureSellLocalSchema();
  try {
    const raw = localStorage.getItem(SELL_FLOW_PROGRESS_KEY);
    if (!raw) return defaultSellFlowProgress();
    const parsed = JSON.parse(raw) as Partial<SellFlowProgress>;
    const checklist = Array.isArray(parsed.checklist)
      ? parsed.checklist.map(Boolean)
      : emptyChecklist();
    while (checklist.length < PSA_PACK_CHECKLIST.length) checklist.push(false);
    const step = parsed.step;
    const validStep: SellFlowStep =
      step === "register" ||
      step === "vault" ||
      step === "self-mint" ||
      step === "cards" ||
      step === "shipping-pack" ||
      step === "shipping-track"
        ? step
        : "register";
    const vaultChoice: SellVaultChoice | null =
      parsed.vaultChoice === "self" || parsed.vaultChoice === "psa"
        ? parsed.vaultChoice
        : null;
    const carrier: SellCarrier =
      parsed.carrier === "dhl" || parsed.carrier === "ups" || parsed.carrier === "fedex"
        ? parsed.carrier
        : "fedex";
    return defaultSellFlowProgress({
      step: validStep,
      vaultChoice,
      checklist: checklist.slice(0, PSA_PACK_CHECKLIST.length),
      slipDownloaded: Boolean(parsed.slipDownloaded),
      carrier,
      shipDate:
        typeof parsed.shipDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.shipDate)
          ? parsed.shipDate
          : todayIsoDate(),
      trackingNumber:
        typeof parsed.trackingNumber === "string" ? parsed.trackingNumber : "",
      returnAddress: parseReturnAddress(parsed.returnAddress),
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
    });
  } catch {
    return defaultSellFlowProgress();
  }
}

export function writeSellFlowProgress(patch: Partial<SellFlowProgress>) {
  try {
    const next = {
      ...readSellFlowProgress(),
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    if (Array.isArray(patch.checklist)) {
      const checklist = patch.checklist.map(Boolean);
      while (checklist.length < PSA_PACK_CHECKLIST.length) checklist.push(false);
      next.checklist = checklist.slice(0, PSA_PACK_CHECKLIST.length);
    }
    localStorage.setItem(SELL_FLOW_PROGRESS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/** Clear in-progress draft after shipment is confirmed (keep shipment record). */
export function clearSellFlowDraftLocal() {
  try {
    localStorage.removeItem(SELL_FLOW_DRAFT_KEY);
    localStorage.removeItem(SELL_FLOW_PROGRESS_KEY);
    localStorage.removeItem(SELL_SHIPMENT_KEY);
    // Keep SELL_FLOW_OWNER_KEY so the next write stays on this account.
  } catch {
    /* ignore */
  }
}

export function confirmedSellCards(cards: SellDraftCard[]): SellDraftCard[] {
  return cards.filter((c) => c.confirmed);
}

export function bannerCardLabel(cards: SellDraftCard[]): string {
  const confirmed = confirmedSellCards(cards);
  if (confirmed.length === 0) return "Your cards";
  if (confirmed.length === 1) {
    const { line1 } = formatSellCardDisplay(confirmed[0]!);
    return line1.length > 48 ? `${line1.slice(0, 46)}…` : line1;
  }
  return `${confirmed.length} cards · PSA graded`;
}

export function parseGradeNumber(grade: string | null | undefined): number {
  if (!grade) return 10;
  const m = String(grade).match(/(\d+(?:\.\d+)?)/);
  const n = m ? Number(m[1]) : 10;
  return n === 9 || n === 10 ? n : 10;
}

/** Line 1 + Line 2 per docs/guides/card-display-name.md */
export function sellDraftCardDisplay(
  card: SellDraftCard,
  opts?: { certOnLine2?: boolean },
) {
  return formatSellCardDisplay(card, opts);
}

/** Map API submission items → local draft cards. */
export function draftCardsFromSubmissionItems(
  items: Array<{
    cert: string;
    name: string | null;
    grade: string | null;
    imageUrl: string | null;
    status: string;
    cardNumber?: string | null;
    year?: string | null;
    setName?: string | null;
    language?: string | null;
    variant?: string | null;
  }>,
): SellDraftCard[] {
  return items.map((it) => ({
    cert: it.cert,
    name: it.name?.trim() || `PSA CERT #${it.cert}`,
    grade: parseGradeNumber(it.grade),
    img: it.imageUrl,
    confirmed: it.status === "confirmed" || it.status === "in_transit",
    cardNumber: it.cardNumber ?? null,
    year: it.year ?? null,
    setName: it.setName ?? null,
    language: it.language ?? null,
    variant: it.variant ?? null,
  }));
}

/** Resume URL for a server-backed package (ship+). Pre-ship drafts are local-only. */
export function sellSubmissionResumeHref(status: string, publicId: string): string {
  if (status === "awaiting_shipment" || status === "draft") {
    // Legacy status=draft should go to shipping, not /sell/flow (cards are local).
    return `/sell/shipping?submission=${encodeURIComponent(publicId)}`;
  }
  return `/vault/submissions/${encodeURIComponent(publicId)}`;
}

/** Vault hub → enter tracking on the ship flow track step. */
export function sellSubmissionAddTrackingHref(publicId: string): string {
  return `/sell/shipping?submission=${encodeURIComponent(publicId)}&panel=track`;
}

export async function downloadPackingSlip(cards: SellDraftCard[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const confirmed = confirmedSellCards(cards);
  const marginX = 56;
  let y = 64;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("TOKENABLE — PACKING SLIP", marginX, y);
  y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Place this slip inside the box before sealing.", marginX, y);
  y += 28;

  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("SHIP TO", marginX, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(PSA_SHIP_TO.name, marginX, y);
  y += 15;
  for (const line of PSA_SHIP_TO.lines) {
    doc.text(line, marginX, y);
    y += 14;
  }
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.text("CARDS IN THIS SHIPMENT", marginX, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  if (confirmed.length === 0) {
    doc.text("No confirmed cards.", marginX, y);
    y += 14;
  } else {
    for (const [i, c] of confirmed.entries()) {
      const { line1, line2 } = formatSellCardDisplay(c, { certOnLine2: true });
      const detail = line2 ? `${line1} — ${line2}` : line1;
      const line = `${i + 1}. ${detail}`;
      const wrapped = doc.splitTextToSize(line, 500);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 13 + 4;
      if (y > 720) {
        doc.addPage();
        y = 64;
      }
    }
  }

  y += 20;
  doc.setDrawColor(200);
  doc.line(marginX, y, 556, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(180, 40, 50);
  const warning = doc.splitTextToSize(
    "IMPORTANT: The Packing Slip must be inside the box. PSA cannot match your card to your Tokenable account without it.",
    500,
  );
  doc.text(warning, marginX, y);
  y += warning.length * 13 + 16;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toISOString()}`, marginX, y);

  doc.save("tokenable-packing-slip.pdf");
}

export const CARRIER_LABELS: Record<SellCarrier, string> = {
  fedex: "FedEx",
  dhl: "DHL",
  ups: "UPS",
};

export const CARRIER_TRACK_URLS: Record<SellCarrier, string> = {
  fedex: "https://www.fedex.com/fedextrack/?trknbr=",
  dhl: "https://www.dhl.com/en/express/tracking.html?AWB=",
  ups: "https://www.ups.com/track?tracknum=",
};

const TRACK_RULES: Record<SellCarrier, { re: RegExp; hint: string }> = {
  fedex: { re: /^\d{12}(\d{3})?$/, hint: "FedEx tracking is 12 or 15 digits." },
  dhl: { re: /^\d{10}$/, hint: "DHL tracking is 10 digits." },
  ups: { re: /^1Z[0-9A-Z]{16}$/i, hint: "UPS tracking is 1Z + 16 characters." },
};

export function validateTracking(
  carrier: SellCarrier,
  raw: string,
): { ok: boolean; hint: string } {
  const cleaned = raw.replace(/\s+/g, "").toUpperCase();
  if (!cleaned) return { ok: false, hint: "" };
  const rule = TRACK_RULES[carrier];
  return { ok: rule.re.test(cleaned), hint: rule.hint };
}

export function readSellSubmissionPublicId(): string | null {
  try {
    return localStorage.getItem(SELL_SUBMISSION_PUBLIC_ID_KEY);
  } catch {
    return null;
  }
}

export function writeSellSubmissionPublicId(publicId: string) {
  ensureSellLocalSchema();
  try {
    localStorage.setItem(SELL_SUBMISSION_PUBLIC_ID_KEY, publicId);
  } catch {
    /* ignore */
  }
}

export function clearSellSubmissionPublicId() {
  try {
    localStorage.removeItem(SELL_SUBMISSION_PUBLIC_ID_KEY);
  } catch {
    /* ignore */
  }
}
