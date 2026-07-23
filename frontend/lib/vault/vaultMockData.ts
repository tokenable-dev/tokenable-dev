
export const MOCK_SUBMISSION_ID = "SUB-20260616-00421";

export const MOCK_CARD = {
  name: "1999 POKEMON BASE SET 1ST EDITION #4 CHARIZARD HOLO",
  grade: "PSA 10",
  cert: "12345678",
  tokenId: "0421",
  imageUrl: "",
  marketValueUsd: 25376,
} as const;

export type VaultIpStatusKind =
  | "token-sent"
  | "in-transit"
  | "reviewing"
  | "minting"
  | "action-needed";

export type VaultInProgressItem = {
  id: string;
  name: string;
  grade: string;
  imageUrl: string;
  statusKind: VaultIpStatusKind;
  statusLabel: string;
  detail?: string;
  trackingUrl?: string;
  hint?: string;
  actionNeeded?: boolean;
  cta: { label: string; href: string; primary?: boolean };
};

export type VaultSubmissionHistoryItem = {
  id: string;
  name: string;
  grade: string;
  cert: string;
  submitted: string;
  status: "Minted" | "Rejected";
  imageUrl: string;
  href: string;
};

/** Draft submission row — Vault-Step-Indicator.html draft-card */
export const MOCK_DRAFT_SUBMISSION = {
  id: "draft-1",
  title: "Charizard + 2 more cards",
  savedAt: "Jul 8, 2026",
  imageUrl: "",
  href: "/vault/submit",
} as const;

/** Active dashboard — matches Vault-Dashboard-Active.html (3 in-progress cards) */
export const MOCK_IN_PROGRESS_ACTIVE: VaultInProgressItem[] = [
  {
    id: "ip-2",
    name: "2024 POKEMON SURGING SPARKS EN-SSP #238 PIKACHU EX SPECIAL ART RARE",
    grade: "PSA 9",
    imageUrl: "",
    statusKind: "in-transit",
    statusLabel: "In Transit",
    detail: "FedEx · FX987654321",
    trackingUrl: "https://www.fedex.com/fedextrack/?trknbr=FX987654321",
    cta: { label: "Track", href: `/vault/submissions/${MOCK_SUBMISSION_ID}?scenario=C` },
  },
  {
    id: "ip-3",
    name: "2024 POKEMON SV DESTINED RIVALS #233 NIDOKING EX STELLAR RARE",
    grade: "PSA 9",
    imageUrl: "",
    statusKind: "reviewing",
    statusLabel: "Reviewing",
    detail: "PSA approval pending",
    cta: { label: "View", href: `/vault/submissions/${MOCK_SUBMISSION_ID}?scenario=D` },
  },
  {
    id: "ip-5",
    name: "2018 PANINI PRIZM #280 LUKA DONCIC BLUE ICE ROOKIE",
    grade: "PSA 10",
    imageUrl: "",
    statusKind: "action-needed",
    statusLabel: "Action Needed",
    hint: "Tracking number required to continue",
    actionNeeded: true,
    cta: { label: "Add Tracking", href: "/vault/submit/shipping", primary: true },
  },
];

export const MOCK_SUBMISSION_HISTORY: VaultSubmissionHistoryItem[] = [
  {
    id: "h-1",
    name: MOCK_CARD.name,
    grade: "PSA 10",
    cert: "12345678",
    submitted: "Jun 15, 2026",
    status: "Minted",
    imageUrl: "",
    href: `/vault/submissions/${MOCK_SUBMISSION_ID}?scenario=G`,
  },
  {
    id: "h-2",
    name: "2023 POKEMON PROMO SVP #085 PIKACHU WITH GREY FELT HAT VAN GOGH",
    grade: "PSA 10",
    cert: "22938102",
    submitted: "Jun 10, 2026",
    status: "Minted",
    imageUrl: "",
    href: `/vault/submissions/${MOCK_SUBMISSION_ID}?scenario=G`,
  },
  {
    id: "h-3",
    name: "2024 TOPPS CHROME #1 SHOHEI OHTANI ROOKIE",
    grade: "PSA 10",
    cert: "88712304",
    submitted: "Jun 8, 2026",
    status: "Minted",
    imageUrl: "",
    href: `/vault/submissions/${MOCK_SUBMISSION_ID}?scenario=G`,
  },
  {
    id: "h-4",
    name: "1986 FLEER #57 MICHAEL JORDAN ROOKIE",
    grade: "PSA 10",
    cert: "55501248",
    submitted: "May 28, 2026",
    status: "Minted",
    imageUrl: "",
    href: `/vault/submissions/${MOCK_SUBMISSION_ID}?scenario=G`,
  },
  {
    id: "h-5",
    name: "1999 POKEMON BASE SET #150 MEWTWO HOLO",
    grade: "PSA 10",
    cert: "33901482",
    submitted: "May 20, 2026",
    status: "Minted",
    imageUrl: "",
    href: `/vault/submissions/${MOCK_SUBMISSION_ID}?scenario=G`,
  },
  {
    id: "h-6",
    name: "1999 POKEMON BASE SET 1ST EDITION #4 CHARIZARD HOLO",
    grade: "PSA 8",
    cert: "12345678",
    submitted: "Jun 1, 2026",
    status: "Rejected",
    imageUrl: "",
    href: `/vault/submissions/${MOCK_SUBMISSION_ID}?view=rejected`,
  },
];

export const MOCK_HUB_STATS_ACTIVE = {
  inProgress: 3,
  completed: 9,
  rejected: 1,
} as const;

/** Replace with API — empty when user has no in-flight vault processes */
export function getVaultInProgressItems(): VaultInProgressItem[] {
  return MOCK_IN_PROGRESS_ACTIVE;
}

export function hasVaultActiveProcesses(): boolean {
  return getVaultInProgressItems().length > 0;
}

export const VAULT_SHIP_ADDRESS = {
  name: "Tokenable Vault Services",
  lines: ["1209 Orange Street, Suite 200", "Wilmington, DE 19801", "United States"],
} as const;

export const VAULT_SHIPPING_CHECKLIST = [
  "Wrap slab in an individual plastic sleeve to prevent surface scratches",
  "Place thick cardboard on both sides, secure with rubber band or tape",
  "Wrap in bubble wrap at least 2–3 times",
  "Fill all empty box space with packing material — no movement allowed",
  "Attach Submission ID barcode label on the outside of the box",
  "Include the Packing Slip inside the box",
] as const;

export const VAULT_DETAIL_SHIP_ADDRESS = {
  name: "Tokenable Vault Services",
  lines: ["1105 N Market St, Suite 1300", "Wilmington, DE 19801", "United States"],
} as const;

export const VAULT_SHIPPING_CARRIERS_ALLOWED = [
  { name: "FedEx International Priority", detail: "3–4 business days", recommended: true },
  { name: "DHL Express", detail: "3–5 business days" },
  { name: "Korea Post EMS (등기)", detail: "5–7 business days" },
] as const;

export const VAULT_SHIPPING_CARRIERS_DENIED = [
  { name: "Regular untracked mail", detail: "NOT allowed" },
  { name: "Unofficial courier", detail: "NOT allowed" },
] as const;

export const VAULT_FAQ_ITEMS = [
  {
    q: "What grades are accepted?",
    a: "Only PSA 9 and PSA 10 graded cards are eligible for vaulting. Cards graded PSA 8 or below will be rejected and returned to you.",
  },
  {
    q: "How long does minting take?",
    a: "After your card arrives and passes intake verification, minting typically completes within 24 hours. You'll receive an email when your token is ready.",
  },
  {
    q: "What happens if my card is rejected?",
    a: "If your card doesn't meet our eligibility criteria, we'll notify you and arrange return shipping at your expense within 7–10 business days.",
  },
  {
    q: "Is my card insured during shipping?",
    a: "Shipping insurance is your responsibility. We strongly recommend insuring cards valued over $500 and using a trackable carrier.",
  },
] as const;

/** Vault-Submit.html FAQ accordion */
export const VAULT_SUBMIT_FAQ_ITEMS = [
  {
    q: "What cards are accepted?",
    a: "Only PSA 9 or PSA 10 graded cards. Cards below PSA 9 will be rejected and returned at the submitter's expense.",
    defaultOpen: true,
  },
  {
    q: "My card isn't graded yet. What should I do?",
    a: "You'll need to submit your card to PSA for grading first. Once graded PSA 9 or higher, you can submit it to our Vault for tokenization.",
  },
  {
    q: "Do you accept BGS, CGC or other graders?",
    a: "Currently we only accept PSA-graded cards. Support for BGS and CGC is planned for a future update.",
  },
  {
    q: "Where do I ship my card?",
    a: "After submitting your card for vault, you'll receive detailed shipping instructions including our secure vault facility address and a pre-printed shipping label.",
  },
  {
    q: "What if my card is lost in transit?",
    a: "Shipping is the sender's responsibility. We strongly recommend using insured, trackable shipping methods. Once received at our facility, your card is fully insured.",
  },
  {
    q: "Is my card insured while in the Vault?",
    a: "Yes. All cards in the Vault are insured up to their appraised market value through our insurance partner.",
  },
  {
    q: "Can I get my card back?",
    a: "Yes. You can request a withdrawal at any time from your Portfolio page. Processing takes approximately 14–16 business days before shipment.",
  },
  {
    q: "How long does the process take?",
    a: "Typically 7–14 business days from when we receive your card: 1–2 days for verification, 1–3 days for vaulting, and 3–5 days for minting your token.",
  },
  {
    q: "Can I trade while my card is in the Vault?",
    a: "Absolutely. Once tokenized, your card's token can be traded on the Tokenable marketplace while the physical card remains safely in the Vault.",
  },
] as const;
