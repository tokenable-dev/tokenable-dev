"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { uploadRwaMetadata, analyzePsaSlab, type PsaAnalyzeResult } from "@/lib/api";
import { TOKENABLE_RWA_ADDRESS, TOKENABLE_RWA_MINT_ABI } from "@/constants/contracts";
import { sepolia } from "@/config/wagmi";
import { GAS_FALLBACK, gasWithCapFast } from "@/lib/chainGas";
import { useAppStore, selectRefresh } from "@/store";
import {
  EMPTY_PSA_FIELD_LOCKS,
  type GradedCardFormState,
  type GradedCardMetadata,
  type PsaFieldLocks,
} from "@/types/gradedCard";
import { GradedCardSection } from "./GradedCardSection";

type Step = "idle" | "uploading" | "minting" | "success" | "error";

const INITIAL_STATE: GradedCardFormState = {
  name: "",
  description: "",
  image: null,
  gradingCompany: "PSA",
  card: {
    name: "",
    player: "",
    year: "",
    set: "",
    number: "",
  },
  grade: {
    certNumber: "",
    score: "",
    subgrades: {},
  },
  verification: {
    certUrl: "",
    slabFront: null,
    slabBack: null,
  },
};

function computePsaLocksFromResult(
  r: PsaAnalyzeResult,
  prev: GradedCardFormState
): PsaFieldLocks {
  const scoreStr =
    r.psa.gradeScore != null
      ? String(r.psa.gradeScore)
      : (r.psa.gradeLabel?.replace(/[^\d.]/g, "") ?? "");
  const hasScore =
    Boolean(scoreStr.trim()) || Boolean(r.psa.gradeLabel?.trim());
  return {
    certNumber: Boolean(r.psa.certNumber?.trim()),
    score: hasScore,
    cardName: Boolean(r.psa.cardNameHint?.trim()),
    player: false,
    year: Boolean(r.psa.year?.trim()),
    set: Boolean(r.psa.setHint?.trim()),
    number: Boolean(r.psa.cardNumberHint?.trim()),
    certUrl: Boolean(r.psa.certVerifyUrl?.trim()),
    assetName: !prev.name.trim() && Boolean(r.psa.cardNameHint?.trim()),
    labelType: Boolean(r.psa.labelType?.trim()),
    psaCategory: Boolean(r.psa.category?.trim()),
    autographGrade: Boolean(r.psa.autographGrade?.trim()),
    psaPopulation: r.psa.totalPopulation != null,
    psaPopHigher: r.psa.populationHigher != null,
    gradingCompany: true,
  };
}

export function MintForm() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const refresh = useAppStore(selectRefresh);

  const [form, setForm] = useState<GradedCardFormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<{ tokenURI: string; txHash: string } | null>(null);
  const [lastAnalyze, setLastAnalyze] = useState<PsaAnalyzeResult | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  /** Invalidate in-flight PSA analyze when deps change or slab cleared */
  const analyzeNonceRef = useRef(0);
  /** PSA path: blob URL preview for slab capture used as mint fallback */
  const [mintImageBlobUrl, setMintImageBlobUrl] = useState<string | null>(null);
  /** Fields locked after PSA analysis */
  const [psaFieldLocks, setPsaFieldLocks] = useState<PsaFieldLocks>(EMPTY_PSA_FIELD_LOCKS);
  /** True while debounce timer is waiting (so overlay doesn't drop between runs) */
  const [debounceWaiting, setDebounceWaiting] = useState(false);
  const formRef = useRef(form);
  formRef.current = form;

  const { writeContractAsync } = useWriteContract();
  const { data: receipt, isLoading: waitingForReceipt } =
    useWaitForTransactionReceipt({
      hash: result?.txHash as `0x${string}` | undefined,
      chainId: sepolia.id,
    });

  const updateForm = useCallback(<K extends keyof GradedCardFormState>(
    key: K,
    value: GradedCardFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateCard = useCallback((card: GradedCardFormState["card"]) => {
    setForm((prev) => ({ ...prev, card }));
  }, []);

  const updateVerification = useCallback(
    (verification: GradedCardFormState["verification"]) => {
      setForm((prev) => ({ ...prev, verification }));
    },
    []
  );

  const updateGradePartial = useCallback(
    (grade: Partial<GradedCardFormState["grade"]>) => {
      setForm((prev) => ({ ...prev, grade: { ...prev.grade, ...grade } }));
    },
    []
  );

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Asset name is required";
    let hasImage = false;
    if (lastAnalyze?.psaCertImages?.front) {
      hasImage = true;
    } else {
      hasImage =
        form.image instanceof File ||
        (typeof form.image === "string" && !!form.image.trim());
    }
    if (!hasImage) {
      next.image =
        "Upload a slab front and wait for analysis to prepare the mint image. If PSA does not return an official image URL, your slab photo is used.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildMetadata(): GradedCardMetadata {
    const metadata: GradedCardMetadata = {
      name: form.name,
      image: "", // Will be set after IPFS upload
    };
    if (form.description.trim()) metadata.description = form.description;

    metadata.gradingCompany = "PSA";

    const hasCard =
      form.card.name ||
      form.card.player ||
      form.card.year ||
      form.card.set ||
      form.card.number;
    if (hasCard) {
      metadata.card = {};
      if (form.card.name) metadata.card.name = form.card.name;
      if (form.card.player) metadata.card.player = form.card.player;
      if (form.card.year) {
        const y = parseInt(form.card.year, 10);
        if (!Number.isNaN(y)) metadata.card.year = y;
      }
      if (form.card.set) metadata.card.set = form.card.set;
      if (form.card.number) metadata.card.number = form.card.number;
    }

    const hasGrade =
      form.grade.certNumber ||
      form.grade.score ||
      Object.keys(form.grade.subgrades).length > 0;
    if (hasGrade) {
      metadata.grade = {};
      if (form.grade.certNumber) metadata.grade.certNumber = form.grade.certNumber;
      if (form.grade.score) {
        const s = parseFloat(form.grade.score);
        if (!Number.isNaN(s)) metadata.grade.score = s;
      }
      if (Object.keys(form.grade.subgrades).length > 0) {
        metadata.grade.subgrades = { ...form.grade.subgrades };
      }
    }

    const hasVerification =
      form.verification.certUrl ||
      form.verification.slabFront ||
      form.verification.slabBack;
    if (hasVerification) {
      metadata.verification = {};
      if (form.verification.certUrl)
        metadata.verification.certUrl = form.verification.certUrl;
      if (form.verification.slabFront)
        metadata.verification.slabFront = ""; // Will be set after IPFS upload
      if (form.verification.slabBack)
        metadata.verification.slabBack = ""; // Will be set after IPFS upload
    }

    const scoreFromForm = parseFloat(form.grade.score);
    metadata.psa = {
        certNumber: form.grade.certNumber || lastAnalyze?.psa.certNumber,
        gradeLabel: lastAnalyze?.psa.gradeLabel,
        gradeScore: Number.isNaN(scoreFromForm)
          ? lastAnalyze?.psa.gradeScore
          : scoreFromForm,
        gradeDescription: lastAnalyze?.psa.gradeDescription,
        certVerifyUrl: form.verification.certUrl || lastAnalyze?.psa.certVerifyUrl,
        cardNameHint: lastAnalyze?.psa.cardNameHint,
        setHint: lastAnalyze?.psa.setHint,
        cardNumberHint: lastAnalyze?.psa.cardNumberHint,
        year: lastAnalyze?.psa.year,
        labelType: lastAnalyze?.psa.labelType,
        category: lastAnalyze?.psa.category,
        autographGrade:
          typeof form.grade.subgrades.autographGrade === "string"
            ? form.grade.subgrades.autographGrade
            : lastAnalyze?.psa.autographGrade,
        totalPopulation: lastAnalyze?.psa.totalPopulation,
        populationHigher: lastAnalyze?.psa.populationHigher,
        totalPopulationWithQualifier: lastAnalyze?.psa.totalPopulationWithQualifier,
        reverseBarcode: lastAnalyze?.psa.reverseBarcode,
        specId: lastAnalyze?.psa.specId,
        enrichedFromOfficialApi: lastAnalyze?.psa.enrichedFromOfficialApi,
        /** PSA cert image source URL for provenance (separate from mint image pipeline) */
        ...(lastAnalyze?.psaCertImages?.front
          ? { certImageSourceUrl: lastAnalyze.psaCertImages.front }
          : {}),
      };
      if (lastAnalyze) {
        metadata.justtcg = {
          queryUsed: lastAnalyze.justtcg.queryUsed,
          topMatch: lastAnalyze.justtcg.topMatch ?? undefined,
        };
        const l = lastAnalyze.psaApi.lookup;
        metadata.psaApi = {
          status: l.status,
          ...(l.status === "success" && { certNumber: l.certNumber }),
          ...(l.status === "error" && { message: l.message }),
        };
      }

    return metadata;
  }

  function buildOpenSeaAttributes(): { trait_type: string; value: string }[] {
    const attrs: { trait_type: string; value: string }[] = [];
    attrs.push({ trait_type: "Grading Company", value: "PSA" });
    if (form.grade.certNumber)
      attrs.push({ trait_type: "PSA Cert #", value: form.grade.certNumber });
    if (form.grade.score)
      attrs.push({ trait_type: "Grade", value: form.grade.score });
    if (form.card.name)
      attrs.push({ trait_type: "Card Name", value: form.card.name });
    if (form.card.set) attrs.push({ trait_type: "Set", value: form.card.set });
    if (form.card.number)
      attrs.push({ trait_type: "Card #", value: form.card.number });
    const sg = form.grade.subgrades;
    if (typeof sg.psaPopulation === "string" && sg.psaPopulation.trim())
      attrs.push({ trait_type: "PSA Population", value: sg.psaPopulation });
    if (typeof sg.psaPopHigher === "string" && sg.psaPopHigher.trim())
      attrs.push({ trait_type: "PSA Pop Higher", value: sg.psaPopHigher });
    if (typeof sg.labelType === "string" && sg.labelType.trim())
      attrs.push({ trait_type: "PSA Label Type", value: sg.labelType });
    if (typeof sg.psaCategory === "string" && sg.psaCategory.trim())
      attrs.push({ trait_type: "PSA Category", value: sg.psaCategory });
    return attrs;
  }

  function resetForm() {
    setStep("idle");
    setErrorMsg("");
    setResult(null);
    setLastAnalyze(null);
    setAnalyzeError("");
    analyzeNonceRef.current += 1;
    setForm(INITIAL_STATE);
    setErrors({});
    setPsaFieldLocks(EMPTY_PSA_FIELD_LOCKS);
  }

  const applyPsaAnalyzeResult = useCallback((r: PsaAnalyzeResult, slabFront: File) => {
    const prev = formRef.current;
    setPsaFieldLocks(computePsaLocksFromResult(r, prev));
    setLastAnalyze(r);
    const scoreStr =
      r.psa.gradeScore != null
        ? String(r.psa.gradeScore)
        : (r.psa.gradeLabel?.replace(/[^\d.]/g, "") ?? "");
    const gLabel = r.psa.gradeScore ?? r.psa.gradeLabel ?? "";
    const fmt = (n: number) => n.toLocaleString("en-US");
    setForm((prev) => ({
      ...prev,
      grade: {
        ...prev.grade,
        certNumber: r.psa.certNumber ?? prev.grade.certNumber,
        score: scoreStr || prev.grade.score,
        subgrades: {
          ...prev.grade.subgrades,
          ...(r.psa.autographGrade && {
            autographGrade: r.psa.autographGrade,
          }),
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
        ...prev.card,
        name: r.psa.cardNameHint || prev.card.name,
        year: r.psa.year || prev.card.year,
        set: r.psa.setHint || prev.card.set,
        number: r.psa.cardNumberHint || prev.card.number,
      },
      verification: {
        ...prev.verification,
        certUrl: r.psa.certVerifyUrl || prev.verification.certUrl,
      },
      name:
        !prev.name.trim() && r.psa.cardNameHint
          ? `${r.psa.cardNameHint} PSA ${gLabel}`.trim()
          : prev.name,
      image: prev.image ?? slabFront,
    }));
  }, []);

  const certHintForPsa = useCallback((): string | undefined => {
    const num = form.grade.certNumber.trim();
    if (num) return num;
    const url = form.verification.certUrl.trim();
    return url || undefined;
  }, [form.grade.certNumber, form.verification.certUrl]);

  const executePsaAnalyze = useCallback(
    async (front: File, back: File | null) => {
      const n = ++analyzeNonceRef.current;
      setAnalyzeError("");
      setAnalyzeLoading(true);
      try {
        const r = await analyzePsaSlab(front, back, certHintForPsa());
        if (n !== analyzeNonceRef.current) return;
        applyPsaAnalyzeResult(r, front);
      } catch (err: unknown) {
        if (n !== analyzeNonceRef.current) return;
        setAnalyzeError(err instanceof Error ? err.message : "Analyze failed");
      } finally {
        if (n === analyzeNonceRef.current) {
          setAnalyzeLoading(false);
        }
      }
    },
    [applyPsaAnalyzeResult, certHintForPsa],
  );

  /** Auto-run PSA analyze when slab files change (debounced) */
  useEffect(() => {
    const front = form.verification.slabFront;
    if (!(front instanceof File)) {
      analyzeNonceRef.current += 1;
      setAnalyzeLoading(false);
      setDebounceWaiting(false);
      setLastAnalyze(null);
      setAnalyzeError("");
      setPsaFieldLocks(EMPTY_PSA_FIELD_LOCKS);
      return;
    }
    /** Keep overlay on during debounce (was flickering off for ~900ms before API started) */
    setAnalyzeLoading(true);
    setDebounceWaiting(true);
    const back =
      form.verification.slabBack instanceof File ? form.verification.slabBack : null;

    /** Debounce to reduce duplicate PSA API calls when picking front/back in sequence */
    const debounceMs = 900;
    const t = window.setTimeout(() => {
      setDebounceWaiting(false);
      void executePsaAnalyze(front, back);
    }, debounceMs);

    return () => clearTimeout(t);
  }, [
    form.verification.slabFront,
    form.verification.slabBack,
    form.grade.certNumber,
    form.verification.certUrl,
    executePsaAnalyze,
  ]);

  useEffect(() => {
    if (!(form.image instanceof File)) {
      setMintImageBlobUrl(null);
      return;
    }
    const u = URL.createObjectURL(form.image);
    setMintImageBlobUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [form.image]);

  function handleAnalyzePsaManual() {
    const front =
      form.verification.slabFront instanceof File ? form.verification.slabFront : null;
    const back =
      form.verification.slabBack instanceof File ? form.verification.slabBack : null;
    if (!front) {
      setAnalyzeError("Upload a slab front image first (Slab Front in Verification).");
      return;
    }
    void executePsaAnalyze(front, back);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !address || !isConnected) return;

    setErrorMsg("");
    setStep("uploading");

    try {
      const data = new FormData();
      data.append("name", form.name);
      data.append("description", form.description.trim() || "No description");
      const psaMintUrl = lastAnalyze?.psaCertImages?.front;
      if (psaMintUrl) {
        data.append("imageUrl", psaMintUrl);
      } else if (form.image instanceof File) {
        data.append("image", form.image);
      } else if (typeof form.image === "string" && form.image.trim()) {
        data.append("imageUrl", form.image);
      }

      const meta = buildMetadata();
      data.append(
        "gradedMetadata",
        JSON.stringify({
          graded: {
            gradingCompany: "PSA",
            card: meta.card,
            grade: meta.grade,
            verification: meta.verification,
            psa: meta.psa,
            justtcg: meta.justtcg,
          },
          attributes: buildOpenSeaAttributes(),
          external_url:
            form.verification.certUrl || lastAnalyze?.psa.certVerifyUrl || undefined,
        })
      );

      const uploadResult = await uploadRwaMetadata(data);
      setStep("minting");

      if (!publicClient) throw new Error("Network not ready");
      const gas = await gasWithCapFast(
        publicClient,
        {
          address: TOKENABLE_RWA_ADDRESS,
          abi: TOKENABLE_RWA_MINT_ABI,
          functionName: "mint",
          args: [address, uploadResult.tokenURI],
          account: address,
        },
        GAS_FALLBACK.rwaMint,
      );
      const txHash = await writeContractAsync({
        address: TOKENABLE_RWA_ADDRESS,
        abi: TOKENABLE_RWA_MINT_ABI,
        functionName: "mint",
        args: [address, uploadResult.tokenURI],
        chainId: sepolia.id,
        gas,
      });

      setResult({ tokenURI: uploadResult.tokenURI, txHash });
      setStep("success");
      refresh();
      if (publicClient) {
        void publicClient
          .waitForTransactionReceipt({ hash: txHash as `0x${string}` })
          .then(() => refresh());
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setErrorMsg(message);
      setStep("error");
    }
  }

  const isProcessing = step === "uploading" || step === "minting";
  /** debounceWaiting covers the gap after one request finishes before the next debounced call runs */
  const slabAnalyzing =
    (analyzeLoading || debounceWaiting) &&
    form.verification.slabFront instanceof File;

  useEffect(() => {
    if (!slabAnalyzing) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [slabAnalyzing]);

  if (step === "success" && result) {
    return (
      <div className="bg-gray-900/50 border border-mint-deep/35 rounded-xl p-6">
        <div className="text-center mb-5">
          <h3 className="text-xl font-bold text-white">Asset Minted Successfully!</h3>
        </div>
        <div className="space-y-3">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Token URI</p>
            <p className="text-xs font-mono text-mint break-all">
              {result.tokenURI}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
            <p className="text-xs font-mono text-blue-400 break-all">
              {result.txHash}
            </p>
          </div>
          {waitingForReceipt && (
            <p className="text-xs text-gray-500 text-center animate-pulse">
              Waiting for confirmation...
            </p>
          )}
          {receipt && (
            <p className="text-xs text-mint text-center">
              ✓ Confirmed in block #{receipt.blockNumber.toString()}
            </p>
          )}
        </div>
        <button
          onClick={resetForm}
          className="mt-5 w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Mint Another
        </button>
      </div>
    );
  }

  return (
    <>
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 transition-all duration-200">
      <h2 className="text-lg font-bold text-white mb-5">Mint Graded Card Asset</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <>
            <GradedCardSection
              gradingCompany={form.gradingCompany}
              card={form.card}
              onCardChange={updateCard}
              grade={form.grade}
              onGradeChange={updateGradePartial}
              verification={form.verification}
              onVerificationChange={updateVerification}
              psaFieldLocks={psaFieldLocks}
            />

            <div className="space-y-4">
              <section className="overflow-hidden rounded-xl border border-gray-800/90 bg-gray-900/35">
                <header className="border-b border-gray-800/80 bg-black/20 px-4 py-3 sm:px-5 sm:py-4">
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    RWA mint image
                  </h3>
                  <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
                    After analysis of your slab front, if PSA returns an official image URL,{" "}
                    <span className="font-medium text-gray-300">that image</span> is used for
                    the asset. Otherwise your slab photo is used.
                  </p>
                </header>

                <div className="space-y-5 p-4 sm:p-5">
              {slabAnalyzing ? (
                <div className="rounded-lg border border-dashed border-gray-700/80 bg-gray-900/20 px-4 py-8 text-center">
                  <p className="text-sm text-gray-500">
                    The mint image will appear here when analysis finishes.
                  </p>
                </div>
              ) : (
                <>
              {lastAnalyze?.psaCertImages?.front && (
                <div className="space-y-4 rounded-lg border border-gray-700/80 bg-gray-900/40 p-4 sm:p-5">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
                    <div className="mx-auto flex shrink-0 flex-col items-center lg:mx-0">
                      <span className="mb-2 inline-flex items-center rounded-md border border-gray-600 bg-gray-800/80 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        PSA · Mint image
                      </span>
                      <div className="rounded-xl border border-gray-700 bg-[#070a0f] p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={lastAnalyze.psaCertImages.front}
                          alt="PSA cert slab — RWA display image"
                          className="max-h-[min(52vh,280px)] w-auto max-w-[min(100%,280px)] object-contain rounded-lg"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <p className="mt-2 max-w-[260px] text-center text-[10px] leading-snug text-gray-500">
                        From the PSA API. Shown in marketplace and wallets as the card art.
                      </p>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 pt-0 lg:pt-4">
                      <div className="rounded-lg border border-gray-700/80 bg-gray-800/50 p-3">
                        <p className="mb-1.5 text-xs font-medium text-gray-200">
                          Minting with PSA cert image
                        </p>
                        <p className="text-[11px] leading-snug text-gray-400">
                          Only this image from PSA is uploaded to IPFS as the RWA image. The
                          slab snapshot cannot be substituted.
                        </p>
                      </div>
                      <p className="pl-0.5 text-[11px] text-gray-500">
                        Marketplace and wallet use this PSA image as display art.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!lastAnalyze?.psaCertImages?.front &&
                form.image instanceof File &&
                mintImageBlobUrl && (
                  <div className="space-y-2 rounded-lg border border-gray-700/80 bg-gray-900/35 p-4 sm:p-5">
                    <p className="text-xs font-medium text-gray-200">
                      Mint image — slab photo
                    </p>
                    <p className="text-[11px] leading-relaxed text-gray-500">
                      No PSA official image URL for this run. The slab capture below will be
                      used as the RWA image.
                    </p>
                    <div className="inline-block rounded-lg border border-gray-700/80 bg-[#0a0e14] p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={mintImageBlobUrl}
                        alt="Slab photo for mint"
                        className="max-h-52 max-w-[min(100%,280px)] object-contain rounded-lg"
                      />
                    </div>
                  </div>
                )}

              {!lastAnalyze?.psaCertImages?.front &&
                !(form.image instanceof File) &&
                !slabAnalyzing && (
                  <div className="rounded-lg border border-dashed border-gray-700/80 bg-gray-900/20 px-4 py-6 text-center">
                    <p className="mb-1 text-sm font-medium text-gray-300">
                      No mint image yet
                    </p>
                    <p className="mx-auto max-w-md text-[11px] leading-relaxed text-gray-500">
                      Upload a <strong className="text-gray-400">slab front</strong> above.
                      After analysis, the PSA image or your slab photo will show here.
                    </p>
                  </div>
                )}
                </>
              )}

              {errors.image && (
                <p className="text-xs text-red-400">{errors.image}</p>
              )}
                </div>
              </section>
            </div>
        </>

        <div className="space-y-3 rounded-xl border border-gray-800/90 bg-gray-900/30 p-4">
            <p className="text-xs leading-relaxed text-gray-400">
              <strong className="text-gray-300">Auto analysis:</strong> After you choose a
              slab front, OCR, PSA API, and JustTCG run and the form fills in. If you enter{" "}
              <strong className="text-white">Cert #</strong> or{" "}
              <strong className="text-white">Cert URL</strong> first, PSA lookup uses that
              before OCR (recommended when the cert is hard to read).
            </p>
            <p className="text-xs leading-relaxed text-gray-400">
              <strong className="text-gray-300">Photo tip:</strong> One front photo is enough.
              Keep the label, card art, and cert number clearly visible.
            </p>
            <button
              type="button"
              onClick={() => void handleAnalyzePsaManual()}
              disabled={
                analyzeLoading ||
                isProcessing ||
                !(form.verification.slabFront instanceof File)
              }
              className="w-full rounded-lg border border-gray-600 bg-gray-800/80 py-2.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {analyzeLoading ? "Working…" : "Re-run analysis"}
            </button>
            {analyzeError && (
              <p className="text-xs text-red-400 break-words">{analyzeError}</p>
            )}
            {lastAnalyze?.warnings && lastAnalyze.warnings.length > 0 && (
              <ul className="text-[11px] text-amber-200/85 space-y-1 list-disc pl-4 border border-amber-500/20 rounded-lg p-3 bg-amber-500/[0.06]">
                {lastAnalyze.warnings.map((w, i) => (
                  <li key={i} className="leading-snug">
                    {w}
                  </li>
                ))}
              </ul>
            )}
            {lastAnalyze && !analyzeError && (
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                  Extraction summary (debug)
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-black/30 p-2 text-[10px] text-gray-400 whitespace-pre-wrap">
                  {JSON.stringify(
                    {
                      psa: lastAnalyze.psa,
                      psaApi: (() => {
                        const l = lastAnalyze.psaApi.lookup;
                        if (l.status === "success") {
                          return {
                            status: l.status,
                            certNumber: l.certNumber,
                            hasPSACert: !!(l.raw as { PSACert?: unknown })
                              ?.PSACert,
                          };
                        }
                        return l;
                      })(),
                      justtcgQuery: lastAnalyze.justtcg.queryUsed,
                      hasJustTcgMatch: !!lastAnalyze.justtcg.topMatch,
                    },
                    null,
                    2
                  )}
                </pre>
              </details>
            )}
          </div>

        <div className="space-y-4 rounded-xl border border-gray-800/80 bg-gray-900/30 p-4 sm:p-5">
            <p className="text-[11px] leading-relaxed text-gray-500">
              Enter asset name and description after slab analysis and the mint image are
              ready.
            </p>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5" htmlFor="name">
                Asset Name <span className="text-red-400">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="e.g. 2023 Ohtani PSA 10"
                disabled={psaFieldLocks.assetName}
                title={
                  psaFieldLocks.assetName
                    ? "Name was set by PSA analysis and cannot be edited"
                    : undefined
                }
                className="w-full bg-gray-800 border border-gray-700 focus:border-mint rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                required
              />
              {psaFieldLocks.assetName && (
                <p className="mt-1 text-[11px] text-gray-500">
                  Name is fixed by PSA analysis.
                </p>
              )}
              {errors.name && (
                <p className="mt-1 text-xs text-red-400">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5" htmlFor="description">
                Description{" "}
                <span className="text-gray-500 text-xs font-normal">(optional)</span>
              </label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                rows={2}
                placeholder="Describe your graded card..."
                className="w-full bg-gray-800 border border-gray-700 focus:border-mint rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors resize-none"
              />
            </div>
          </div>

        {isProcessing && (
          <div className="flex items-center gap-2 py-2">
            <div className="w-4 h-4 border-2 border-mint border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400">
              {step === "uploading"
                ? "Uploading to IPFS..."
                : "Waiting for MetaMask signature..."}
            </span>
          </div>
        )}

        {step === "error" && errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-xs text-red-400 break-all">{errorMsg}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isProcessing || slabAnalyzing}
          className="w-full py-3 bg-gradient-to-r from-mint to-mint-dim hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed text-mint-ink text-sm font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-mint/25"
        >
          {isProcessing ? "Processing..." : slabAnalyzing ? "Analyzing slab…" : "Mint"}
        </button>
      </form>
    </div>

    {slabAnalyzing &&
      typeof document !== "undefined" &&
      createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px] pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="psa-analyze-overlay-title"
        >
          <div className="w-full max-w-md rounded-xl border border-gray-700/90 bg-gray-950/98 px-5 py-6 shadow-2xl shadow-black/60 sm:px-6 sm:py-7">
            <div className="flex flex-col items-center text-center">
              <div className="relative h-14 w-14 shrink-0">
                <div
                  className="absolute inset-0 rounded-full border-2 border-gray-600"
                  aria-hidden
                />
                <div
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-gray-200 border-r-gray-600 animate-spin"
                  style={{ animationDuration: "0.9s" }}
                  aria-hidden
                />
              </div>
              <p
                id="psa-analyze-overlay-title"
                className="mt-4 text-lg font-semibold tracking-tight text-white"
              >
                Analyzing slab
              </p>
              <p className="mt-2 text-sm text-gray-400">
                OCR, PSA lookup, and JustTCG are running in one request.
              </p>
              <div
                className="mt-4 h-2.5 w-full max-w-[280px] overflow-hidden rounded-full bg-gray-800"
                role="status"
                aria-live="polite"
                aria-label="Analysis in progress"
              >
                <div className="h-full w-full animate-pulse rounded-full bg-gradient-to-r from-gray-600 via-gray-500 to-gray-600" />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-gray-400">
                Typical time is about 30–90 seconds; slow networks can take longer. Please keep
                this tab open until it finishes.
              </p>
              <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.2em] text-gray-600">
                OCR · PSA · JustTCG
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
