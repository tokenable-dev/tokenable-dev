import type { MintFriendlyError } from "@/lib/vault/mintFormConstants";

export function parseFriendlyMintError(msg: string): MintFriendlyError | null {
  const m = msg.toLowerCase();
  if (m.includes("psa 10 또는 psa 인증") || m.includes("psa 10")) {
    return {
      title: "Grade not supported",
      message:
        "Minting is allowed only for PSA 10 slabs or PSA AUTH slabs without a numeric grade (e.g. Authentic / Authentic Altered).",
      hints: [
        "PSA 1–9 numeric grades are not supported.",
        "Re-run cert lookup and confirm the slab grade.",
        "Use a PSA 10 cert or a PSA AUTH qualifier cert.",
      ],
    };
  }
  if (m.includes("psa 등급 카드만 mint 가능합니다") || m.includes("psa 등급")) {
    return {
      title: "PSA verification required",
      message: "This flow accepts only PSA-graded cards.",
      hints: [
        "Switch to PSA cert lookup or slab OCR.",
        "Confirm grading company is PSA in the analyzed metadata.",
      ],
    };
  }
  if (m.includes("psa 인증 메타데이터가 필요합니다")) {
    return {
      title: "PSA metadata missing",
      message: "Minting requires official PSA metadata from OCR/Cert lookup.",
      hints: [
        "Run cert lookup first, then mint.",
        "Do not skip analysis before pressing Mint.",
      ],
    };
  }
  return null;
}
