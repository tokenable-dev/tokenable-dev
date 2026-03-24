"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { uploadNft, analyzePsaSlab, type PsaAnalyzeResult } from "@/lib/api";
import { TOKENABLE_RWA_ADDRESS, TOKENABLE_RWA_MINT_ABI } from "@/constants/contracts";
import { sepolia } from "@/config/wagmi";
import { gasWithCap } from "@/lib/chainGas";
import { useAppStore, selectRefresh } from "@/store";
import type { GradingCompany, GradedCardFormState, GradedCardMetadata } from "@/types/gradedCard";
import { GradedCardSection } from "./GradedCardSection";
import { ImageInput } from "./ImageInput";

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

  const handleCompanyChange = useCallback((company: GradingCompany) => {
    setForm((prev) => ({
      ...prev,
      gradingCompany: company,
      grade: { ...prev.grade, subgrades: {} },
    }));
  }, []);

  const updateGradePartial = useCallback(
    (grade: Partial<GradedCardFormState["grade"]>) => {
      setForm((prev) => ({ ...prev, grade: { ...prev.grade, ...grade } }));
    },
    []
  );

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "NFT name is required";
    const hasImage =
      form.image instanceof File ||
      (typeof form.image === "string" && form.image.trim());
    if (!hasImage) next.image = "Image file or URL is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildMetadata(): GradedCardMetadata {
    const metadata: GradedCardMetadata = {
      name: form.name,
      image: "", // Will be set after IPFS upload
    };
    if (form.description.trim()) metadata.description = form.description;

    if (form.gradingCompany) {
      metadata.gradingCompany = form.gradingCompany;
    }

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

    if (form.gradingCompany === "PSA") {
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
    }

    return metadata;
  }

  function buildOpenSeaAttributes(): { trait_type: string; value: string }[] {
    const attrs: { trait_type: string; value: string }[] = [];
    if (form.gradingCompany)
      attrs.push({ trait_type: "Grading Company", value: form.gradingCompany });
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
  }

  const applyPsaAnalyzeResult = useCallback((r: PsaAnalyzeResult, slabFront: File) => {
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

  const executePsaAnalyze = useCallback(
    async (front: File, back: File | null) => {
      const n = ++analyzeNonceRef.current;
      setAnalyzeError("");
      setAnalyzeLoading(true);
      try {
        const r = await analyzePsaSlab(front, back);
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
    [applyPsaAnalyzeResult],
  );

  /** 슬랩 앞/뒤 파일이 바뀔 때 자동 분석 (디바운스) */
  useEffect(() => {
    if (form.gradingCompany !== "PSA") {
      analyzeNonceRef.current += 1;
      setAnalyzeLoading(false);
      setLastAnalyze(null);
      setAnalyzeError("");
      return;
    }
    const front = form.verification.slabFront;
    if (!(front instanceof File)) {
      analyzeNonceRef.current += 1;
      setAnalyzeLoading(false);
      setLastAnalyze(null);
      setAnalyzeError("");
      return;
    }
    const back =
      form.verification.slabBack instanceof File ? form.verification.slabBack : null;

    /** 슬랩 앞·뒤 연속 선택 시 PSA API 중복 호출(429) 완화 */
    const debounceMs = 900;
    const t = window.setTimeout(() => {
      void executePsaAnalyze(front, back);
    }, debounceMs);

    return () => clearTimeout(t);
  }, [
    form.gradingCompany,
    form.verification.slabFront,
    form.verification.slabBack,
    executePsaAnalyze,
  ]);

  function handleAnalyzePsaManual() {
    const front =
      form.verification.slabFront instanceof File ? form.verification.slabFront : null;
    const back =
      form.verification.slabBack instanceof File ? form.verification.slabBack : null;
    if (!front) {
      setAnalyzeError("슬랩 앞면 이미지를 먼저 업로드하세요 (Verification → Slab Front).");
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
      if (form.image instanceof File) {
        data.append("image", form.image);
      } else if (typeof form.image === "string" && form.image.trim()) {
        data.append("imageUrl", form.image);
      }

      if (form.gradingCompany) {
        const meta = buildMetadata();
        data.append(
          "gradedMetadata",
          JSON.stringify({
            graded: {
              gradingCompany: form.gradingCompany,
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
      }

      const uploadResult = await uploadNft(data);
      setStep("minting");

      if (!publicClient) throw new Error("Network not ready");
      const gas = await gasWithCap(publicClient, {
        address: TOKENABLE_RWA_ADDRESS,
        abi: TOKENABLE_RWA_MINT_ABI,
        functionName: "mint",
        args: [address, uploadResult.tokenURI],
        account: address,
      });
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

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({
          hash: txHash as `0x${string}`,
        });
      }
      refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setErrorMsg(message);
      setStep("error");
    }
  }

  const isProcessing = step === "uploading" || step === "minting";

  if (step === "success" && result) {
    return (
      <div className="bg-gray-900/50 border border-emerald-800/50 rounded-xl p-6">
        <div className="text-center mb-5">
          <h3 className="text-xl font-bold text-white">NFT Minted Successfully!</h3>
        </div>
        <div className="space-y-3">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Token URI</p>
            <p className="text-xs font-mono text-emerald-400 break-all">
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
            <p className="text-xs text-emerald-400 text-center">
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
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 transition-all duration-200">
      <h2 className="text-lg font-bold text-white mb-5">Mint Graded Card NFT</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Base NFT fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5" htmlFor="name">
              NFT Name <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              placeholder="e.g. 2023 Ohtani PSA 10"
              className="w-full bg-gray-800 border border-gray-700 focus:border-amber-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors"
              required
            />
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
              className="w-full bg-gray-800 border border-gray-700 focus:border-amber-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors resize-none"
            />
          </div>

          <ImageInput
            label="Card Image"
            value={form.image}
            onChange={(v) => updateForm("image", v)}
            required
          />
          {errors.image && (
            <p className="text-xs text-red-400">{errors.image}</p>
          )}
        </div>

        <GradedCardSection
          gradingCompany={form.gradingCompany}
          onCompanyChange={handleCompanyChange}
          card={form.card}
          onCardChange={updateCard}
          grade={form.grade}
          onGradeChange={updateGradePartial}
          verification={form.verification}
          onVerificationChange={updateVerification}
        />

        {form.gradingCompany === "PSA" && (
          <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 space-y-3">
            <p className="text-xs text-amber-200/90 leading-relaxed">
              <strong className="text-amber-100">자동 분석:</strong> Verification에서 슬랩
              앞면을 고르면 잠시 후 OCR · PSA API · JustTCG가 실행되고 폼이 채워집니다. 뒷면을
              추가·변경하면 다시 분석합니다.
            </p>
            <p className="text-xs text-amber-200/90 leading-relaxed">
              <strong className="text-amber-100">촬영 팁:</strong> 앞면은 라벨·카드, 뒷면은
              Cert 번호·바코드가 잘 보이게 찍어 주세요.
            </p>
            {analyzeLoading && (
              <div className="flex items-center gap-2 text-xs text-amber-300/90">
                <span className="inline-block w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                슬랩 분석 중…
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleAnalyzePsaManual()}
              disabled={
                analyzeLoading ||
                isProcessing ||
                !(form.verification.slabFront instanceof File)
              }
              className="w-full py-2.5 text-sm font-semibold rounded-lg bg-amber-900/50 hover:bg-amber-800/60 disabled:opacity-50 text-amber-100 border border-amber-800/60 transition-colors"
            >
              {analyzeLoading
                ? "처리 중…"
                : "다시 분석 (수동)"}
            </button>
            {analyzeError && (
              <p className="text-xs text-red-400 break-words">{analyzeError}</p>
            )}
            {lastAnalyze && !analyzeError && (
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                  추출 요약 (검증용)
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
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 py-2">
            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
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
          disabled={isProcessing}
          className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all duration-200 shadow-lg shadow-amber-500/20"
        >
          {isProcessing ? "Processing..." : "Mint"}
        </button>
      </form>
    </div>
  );
}
