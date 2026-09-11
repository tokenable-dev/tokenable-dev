import {
  analyzePsaByCertNumber,
  certMintBlockReason,
  mintRwaViaBackend,
  syncRwaTokenAfterMint,
  uploadRwaMetadata,
  type PsaAnalyzeResult,
} from "@/lib/core";
import type { SupportedChainId } from "@/lib/chains/types";
import { formatCardDisplayName } from "@/lib/marketplace/cardDisplayName";
import {
  buildGradedCardMetadata,
  buildMintOpenSeaAttributes,
} from "@/lib/vault/buildMintMetadata";
import { MINT_FORM_INITIAL_STATE } from "@/lib/vault/mintFormConstants";
import { resolveMintPsaGradeLabel, ensureMintFormHasPsaScore } from "@/lib/vault/resolveMintPsaGradeLabel";
import { resolveSelfVaultMintImageSelection, fileFromImageDataUrl } from "@/lib/vault/mintImageSource";
import type { GradedCardFormState } from "@/types/gradedCard";

/** List-ready title — SSOT Line 1 (`Name · # · Grade`). Never writes `Raw`. */
function mintDisplayNameFromForm(
  form: GradedCardFormState,
  cert: string,
  analyze?: PsaAnalyzeResult | null,
): string {
  const grade = resolveMintPsaGradeLabel({
    score: form.grade.score || analyze?.psa.gradeScore,
    gradeLabel: analyze?.psa.gradeLabel,
    gradeDescription: analyze?.psa.gradeDescription,
  });
  const { line1 } = formatCardDisplayName(
    {
      cardName: form.card.name || form.name || null,
      cardNumber: form.card.number || null,
      grade,
      year: form.card.year || null,
      setName: form.card.set || null,
      language: null,
      variant: null,
    },
    { mode: "line1", omitGrade: !grade },
  );
  return line1.trim() || form.name.trim() || `PSA #${cert}`;
}

/** Build mint form state from a fresh PSA analyze result (cert-lookup path). */
export function gradedFormFromPsaAnalyze(r: PsaAnalyzeResult): GradedCardFormState {
  const scoreStr =
    r.psa.gradeScore != null
      ? String(r.psa.gradeScore)
      : (resolveMintPsaGradeLabel({
            gradeLabel: r.psa.gradeLabel,
            gradeDescription: r.psa.gradeDescription,
          })?.replace(/^PSA\s+/i, "") ?? "");
  const fmt = (n: number) => n.toLocaleString("en-US");
  const name = r.psa.cardNameHint?.trim() || `PSA CERT #${r.psa.certNumber ?? ""}`;
  return {
    ...MINT_FORM_INITIAL_STATE,
    name,
    description: "Minted via Tokenable self vault",
    grade: {
      certNumber: r.psa.certNumber ?? "",
      score: scoreStr,
      subgrades: {
        ...(r.psa.autographGrade && { autographGrade: r.psa.autographGrade }),
        ...(r.psa.totalPopulation != null && {
          psaPopulation: fmt(r.psa.totalPopulation),
        }),
        ...(r.psa.populationHigher != null && {
          psaPopHigher: fmt(r.psa.populationHigher),
        }),
        ...(r.psa.labelType && { labelType: r.psa.labelType }),
        ...(r.psa.category && { psaCategory: r.psa.category }),
      },
    },
    card: {
      name: r.psa.cardNameHint ?? "",
      player: "",
      year: r.psa.year ?? "",
      set: r.psa.setHint ?? "",
      number: r.psa.cardNumberHint ?? "",
    },
    verification: {
      certUrl: r.psa.certVerifyUrl ?? "",
      slabFront: null,
      slabBack: null,
    },
  };
}

/** Prefer draft `card.grade` over a 2nd cert-only PSA analyze. */
function applyPreferredMintGrade(
  form: GradedCardFormState,
  preferred: number | string | null | undefined,
): GradedCardFormState {
  if (preferred == null) return form;
  const label = resolveMintPsaGradeLabel({ score: preferred });
  if (!label) return form;
  const score = label.replace(/^PSA\s+/i, "").trim();
  if (!score) return form;
  return {
    ...form,
    grade: { ...form.grade, score },
  };
}

/**
 * Self-vault mint for one cert — upload IPFS → POST /rwa/mint with
 * deliveryMode=direct (RWA lands in the user's wallet; no admin deliver).
 *
 * Mint image: PSA official slab when available; otherwise the user's slab
 * upload (`userImage` / `userImageDataUrl`); else Cardhedger / Tokenable placeholder.
 */
export async function mintSellFlowCardByCert(input: {
  cert: string;
  recipientAddress: string;
  chainId: SupportedChainId;
  /**
   * Draft card grade from add-card (1st PSA/OCR). Authoritative for mint
   * display_name / IPFS — do not rely on a 2nd cert-only analyze for score.
   */
  preferredGrade?: number | string | null;
  /** Original slab File from Upload — used only when PSA has no cert slab URL. */
  userImage?: File | null;
  /**
   * Draft/localStorage thumb (`data:…`) when the original File is gone (refresh).
   * Converted to a File so mint does not fall through to Tokenable placeholder.
   */
  userImageDataUrl?: string | null;
}): Promise<{ cert: string; tokenId: number; txHash: string }> {
  const cert = input.cert.trim();
  if (!/^\d{7,10}$/.test(cert)) {
    throw new Error(`Invalid cert: ${cert}`);
  }

  const taken = await certMintBlockReason(cert, input.chainId);
  if (taken) {
    throw new Error(taken);
  }

  const analyze = await analyzePsaByCertNumber(cert);
  let form = gradedFormFromPsaAnalyze(analyze);
  form = applyPreferredMintGrade(form, input.preferredGrade);
  form = ensureMintFormHasPsaScore(form, analyze);
  if (!form.grade.certNumber.trim()) {
    form = {
      ...form,
      grade: { ...form.grade, certNumber: cert },
    };
  }

  let userImage: File | null =
    input.userImage instanceof File ? input.userImage : null;
  if (!userImage && input.userImageDataUrl?.trim()) {
    userImage = await fileFromImageDataUrl(
      input.userImageDataUrl,
      `slab-${cert}.jpg`,
    );
  }

  const displayName = mintDisplayNameFromForm(form, cert, analyze);

  const data = new FormData();
  // IPFS `name` must match portfolio Line 1 (`Name · # · PSA 10`), not bare card name.
  data.append("name", displayName || form.name || `PSA CERT #${cert}`);
  data.append("description", form.description.trim() || "No description");

  const mintImage = resolveSelfVaultMintImageSelection({
    analyze,
    certNumber: form.grade.certNumber || cert,
    userImage,
  });
  if (mintImage.imageUrl) {
    data.append("imageUrl", mintImage.imageUrl);
  } else if (mintImage.useUserFile && userImage instanceof File) {
    data.append("image", userImage);
  }

  const meta = buildGradedCardMetadata(form, analyze);
  data.append(
    "gradedMetadata",
    JSON.stringify({
      graded: {
        gradingCompany: "PSA",
        card: meta.card,
        grade: meta.grade,
        verification: meta.verification,
        psa: meta.psa,
        ...(meta.cardhedger ? { cardhedger: meta.cardhedger } : {}),
        ...(meta.normalized ? { normalized: meta.normalized } : {}),
      },
      attributes: buildMintOpenSeaAttributes(form),
      external_url:
        form.verification.certUrl || analyze.psa.certVerifyUrl || undefined,
    }),
  );

  const uploadResult = await uploadRwaMetadata(data, input.chainId);
  const mintResult = await mintRwaViaBackend({
    recipientAddress: input.recipientAddress,
    tokenURI: uploadResult.tokenURI,
    certNumber: form.grade.certNumber.trim() || cert,
    chainId: input.chainId,
    deliveryMode: "direct",
    displayName,
    collectionKey: uploadResult.collectionKey,
    displayImageUrl: uploadResult.displayImageUrl,
    displayImageBackUrl: uploadResult.displayImageBackUrl,
  });
  await syncRwaTokenAfterMint(mintResult.tokenId);

  return {
    cert,
    tokenId: mintResult.tokenId,
    txHash: mintResult.txHash,
  };
}

export type PartnerMintSkipKind =
  | "already_minted"
  | "psa_shipment"
  | "no_image"
  | "rate_limit"
  | "invalid_cert"
  | "other";

export type PartnerMintSkipped = {
  cert: string;
  name: string;
  kind: PartnerMintSkipKind;
  title: string;
  detail: string;
};

export type PartnerMintSucceeded = {
  cert: string;
  name: string;
  tokenId: number;
  /** Snapshot at mint time — draft cards are removed before the done modal paints. */
  grade?: number | string | null;
  cardNumber?: string | null;
  year?: string | null;
  setName?: string | null;
  language?: string | null;
  variant?: string | null;
};

export type PartnerMintBatchResult = {
  succeeded: PartnerMintSucceeded[];
  skipped: PartnerMintSkipped[];
};

/** Partner eligibility errors apply to the whole batch — stop the queue. */
export function isPartnerMintBatchAbort(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("company vault address") ||
    m.includes("contracted tokenable partners")
  );
}

export function classifyPartnerMintSkip(message: string): {
  kind: PartnerMintSkipKind;
  title: string;
} {
  const m = message.toLowerCase();
  if (
    m.includes("active vault cycle") ||
    m.includes("vaultrefalreadyactive") ||
    m.includes("already minted") ||
    m.includes("redeem it before")
  ) {
    return {
      kind: "already_minted",
      title: "Already minted on this chain",
    };
  }
  if (
    m.includes("psa vault shipment") ||
    m.includes("in transit or at psa")
  ) {
    return {
      kind: "psa_shipment",
      title: "Already in a PSA vault shipment",
    };
  }
  if (m.includes("no mint image")) {
    return { kind: "no_image", title: "No slab or catalog image" };
  }
  if (m.includes("rate limit")) {
    return { kind: "rate_limit", title: "PSA rate limit" };
  }
  if (
    m.includes("compute units per second") ||
    m.includes("could not coalesce error") ||
    /\b429\b/.test(m)
  ) {
    return {
      kind: "rate_limit",
      title: "Network busy — wait and retry",
    };
  }
  if (m.includes("invalid cert")) {
    return { kind: "invalid_cert", title: "Invalid cert number" };
  }
  return { kind: "other", title: "Mint failed" };
}
