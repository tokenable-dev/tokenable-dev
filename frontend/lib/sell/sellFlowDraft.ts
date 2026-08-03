export type SellDraftCard = {
  cert: string;
  name: string;
  grade: number;
  img: string | null;
  confirmed: boolean;
};

export const SELL_FLOW_DRAFT_KEY = "tk_sell_flow_draft";
export const SELL_SHIPMENT_KEY = "tk_sell_shipment";
/** Server-backed submission public id (SUB-…) after draft upsert. */
export const SELL_SUBMISSION_PUBLIC_ID_KEY = "tk_sell_submission_public_id";
/** In-progress UI step + shipping form fields (survives refresh / tab close). */
export const SELL_FLOW_PROGRESS_KEY = "tk_sell_flow_progress";
/** Bump only to drop offline-only fake In Transit shipments (not card drafts). */
const SELL_LOCAL_SCHEMA_KEY = "tk_sell_local_schema";
const SELL_LOCAL_SCHEMA = "5";

/** Wipe browser-only sell progress (not server DB). Safe to call often. */
export function clearAllSellLocalState() {
  try {
    localStorage.removeItem(SELL_FLOW_DRAFT_KEY);
    localStorage.removeItem(SELL_FLOW_PROGRESS_KEY);
    localStorage.removeItem(SELL_SHIPMENT_KEY);
    localStorage.removeItem(SELL_SUBMISSION_PUBLIC_ID_KEY);
  } catch {
    /* ignore */
  }
}

function ensureSellLocalSchema() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(SELL_LOCAL_SCHEMA_KEY) === SELL_LOCAL_SCHEMA) return;
    // Drop offline-confirmed shipment mocks — keep in-progress card drafts.
    localStorage.removeItem(SELL_SHIPMENT_KEY);
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

export type SellFlowProgress = {
  step: SellFlowStep;
  /** Set on the Choose a vault screen (null until picked). */
  vaultChoice: SellVaultChoice | null;
  checklist: boolean[];
  slipDownloaded: boolean;
  carrier: SellCarrier;
  shipDate: string;
  trackingNumber: string;
  updatedAt: string;
};

export const PSA_SHIP_TO = {
  name: "PSA — Professional Sports Authenticator",
  lines: [
    "1610 E Saint Andrew Place, Suite 150",
    "Santa Ana, CA 92705",
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
    return Array.isArray(parsed) ? parsed : [];
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
    const c = confirmed[0]!;
    const short = c.name.length > 42 ? `${c.name.slice(0, 40)}…` : c.name;
    return `${short} · PSA ${c.grade}`;
  }
  return `${confirmed.length} cards · PSA graded`;
}

export function parseGradeNumber(grade: string | null | undefined): number {
  if (!grade) return 10;
  const m = String(grade).match(/(\d+(?:\.\d+)?)/);
  const n = m ? Number(m[1]) : 10;
  return n === 9 || n === 10 ? n : 10;
}

/** Map API submission items → local draft cards. */
export function draftCardsFromSubmissionItems(
  items: Array<{
    cert: string;
    name: string | null;
    grade: string | null;
    imageUrl: string | null;
    status: string;
  }>,
): SellDraftCard[] {
  return items.map((it) => ({
    cert: it.cert,
    name: it.name?.trim() || `PSA CERT #${it.cert}`,
    grade: parseGradeNumber(it.grade),
    img: it.imageUrl,
    confirmed: it.status === "confirmed" || it.status === "in_transit",
  }));
}

/** Resume URL for an open submission (draft → ship → detail). */
export function sellSubmissionResumeHref(status: string, publicId: string): string {
  if (status === "draft") return "/sell/flow";
  if (status === "awaiting_shipment") return "/sell/shipping";
  return `/vault/submissions/${encodeURIComponent(publicId)}`;
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
      const line = `${i + 1}. Cert #${c.cert}  |  PSA ${c.grade}  |  ${c.name}`;
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
