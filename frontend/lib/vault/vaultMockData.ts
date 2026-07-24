/**
 * Vault UI helpers — no design-mock card/submission inventory.
 * Operational copy (shipping address, FAQ, checklist) stays for real flows.
 */

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
