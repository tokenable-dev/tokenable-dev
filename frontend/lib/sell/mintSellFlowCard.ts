import {
  analyzePsaByCertNumber,
  mintRwaViaBackend,
  syncRwaTokenAfterMint,
  uploadRwaMetadata,
  type PsaAnalyzeResult,
} from "@/lib/core";
import type { SupportedChainId } from "@/lib/chains/types";
import {
  buildGradedCardMetadata,
  buildMintOpenSeaAttributes,
} from "@/lib/vault/buildMintMetadata";
import { MINT_FORM_INITIAL_STATE } from "@/lib/vault/mintFormConstants";
import { psaCertImageMatchesFormCert } from "@/lib/vault/mintFormPsa";
import type { GradedCardFormState } from "@/types/gradedCard";

/** Build mint form state from a fresh PSA analyze result (cert-lookup path). */
export function gradedFormFromPsaAnalyze(r: PsaAnalyzeResult): GradedCardFormState {
  const scoreStr =
    r.psa.gradeScore != null
      ? String(r.psa.gradeScore)
      : (r.psa.gradeLabel?.replace(/[^\d.]/g, "") ?? "");
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

/**
 * Self-vault mint for one cert — upload IPFS → POST /rwa/mint with
 * deliveryMode=direct (NFT lands in the user's wallet; no admin deliver).
 */
export async function mintSellFlowCardByCert(input: {
  cert: string;
  recipientAddress: string;
  chainId: SupportedChainId;
}): Promise<{ cert: string; tokenId: number; txHash: string }> {
  const cert = input.cert.trim();
  if (!/^\d{7,10}$/.test(cert)) {
    throw new Error(`Invalid cert: ${cert}`);
  }

  const analyze = await analyzePsaByCertNumber(cert);
  const form = gradedFormFromPsaAnalyze(analyze);
  if (!form.grade.certNumber.trim()) {
    form.grade.certNumber = cert;
  }

  const data = new FormData();
  data.append("name", form.name || `PSA CERT #${cert}`);
  data.append("description", form.description.trim() || "No description");

  const trustedPsaSlabUrl = psaCertImageMatchesFormCert(
    analyze,
    form.grade.certNumber,
  )
    ? analyze.psaCertImages?.front
    : undefined;
  const selectedMintImageUrl =
    trustedPsaSlabUrl || analyze.cardhedgerMint?.imageUrl;
  if (selectedMintImageUrl) {
    data.append("imageUrl", selectedMintImageUrl);
  } else {
    throw new Error(
      `No mint image for cert ${cert}. PSA/Cardhedger image required.`,
    );
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
    displayImageUrl: uploadResult.displayImageUrl,
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
  if (m.includes("invalid cert")) {
    return { kind: "invalid_cert", title: "Invalid cert number" };
  }
  return { kind: "other", title: "Mint failed" };
}
