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
  });
  await syncRwaTokenAfterMint(mintResult.tokenId);

  return {
    cert,
    tokenId: mintResult.tokenId,
    txHash: mintResult.txHash,
  };
}
