"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  uploadRwaMetadata,
  analyzePsaSlab,
  analyzePsaByCertNumber,
  type PsaAnalyzeResult,
} from "@/lib/core";
import { TOKENABLE_RWA_ADDRESS, TOKENABLE_RWA_MINT_ABI } from "@/constants/contracts";
import { sepolia } from "@/config/wagmi";
import { GAS_FALLBACK, gasWithCapFast } from "@/lib/network";
import { useAppStore, selectRefresh } from "@/store";
import {
  EMPTY_PSA_FIELD_LOCKS,
  type GradedCardFormState,
  type GradedCardMetadata,
  type PsaFieldLocks,
} from "@/types/gradedCard";
import { GradedCardSection, type PsaInputMode } from "./GradedCardSection";
import { WalletConnect } from "@/components/wallet/WalletConnect";

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

type MintFriendlyError = {
  title: string;
  message: string;
  hints: string[];
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
  /** Visual smoothing: prevent 1-frame overlay flicker between state transitions */
  const [analyzeOverlayVisible, setAnalyzeOverlayVisible] = useState(false);
  /** Slab photo OCR path vs Cert-only PSA API lookup */
  const [psaInputMode, setPsaInputMode] = useState<PsaInputMode>("slab");
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
    if (lastAnalyze?.psaCertImages?.front || lastAnalyze?.cardhedgerMint?.imageUrl) {
      hasImage = true;
    } else {
      hasImage =
        form.image instanceof File ||
        (typeof form.image === "string" && !!form.image.trim());
    }
    if (!hasImage) {
      next.image =
        psaInputMode === "cert"
          ? "Run Cert lookup first so PSA can supply an image URL, or switch to slab photos and upload a front image."
          : "Upload a photo and wait for analysis, or use Cert # mode. If PSA does not supply an image URL, your uploaded photo is used.";
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
        ...(lastAnalyze?.psaCertImages?.back
          ? { certImageBackUrl: lastAnalyze.psaCertImages.back }
          : {}),
        /** PSA PSACert.Variety — Silver/Base 등 Cardhedger 병행 구분 (공식 API `varietyHint`) */
        ...(lastAnalyze?.psa.varietyHint?.trim()
          ? { Variety: lastAnalyze.psa.varietyHint.trim() }
          : {}),
      };
      if (lastAnalyze) {
        if (
          lastAnalyze.cardhedgerMint?.matchConfidence === "verified" &&
          lastAnalyze.cardhedgerMint?.cardId?.trim()
        ) {
          metadata.cardhedger = {
            cardId: lastAnalyze.cardhedgerMint.cardId.trim(),
            ...(lastAnalyze.cardhedgerMint.searchQuery != null
              ? { searchQuery: lastAnalyze.cardhedgerMint.searchQuery }
              : {}),
            // Clean catalog image (no PSA cert label) — used as collection cover when available
            ...(lastAnalyze.cardhedgerMint.imageUrl?.trim()
              ? { imageUrl: lastAnalyze.cardhedgerMint.imageUrl.trim() }
              : {}),
          };
        } else if (lastAnalyze.cardhedgerMint?.imageUrl?.trim()) {
          // imageUrl available even without a verified cardId match
          metadata.cardhedger = {
            ...(metadata.cardhedger ?? {}),
            imageUrl: lastAnalyze.cardhedgerMint.imageUrl.trim(),
          };
        }
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
    setPsaInputMode("slab");
  }

  const applyPsaAnalyzeResult = useCallback(
    (r: PsaAnalyzeResult, slabFrontForMint?: File | null) => {
      const prev = formRef.current;
      setPsaFieldLocks(computePsaLocksFromResult(r, prev));
      setLastAnalyze(r);
      const scoreStr =
        r.psa.gradeScore != null
          ? String(r.psa.gradeScore)
          : (r.psa.gradeLabel?.replace(/[^\d.]/g, "") ?? "");
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
            ? String(r.psa.cardNameHint).trim()
            : prev.name,
        ...(slabFrontForMint instanceof File
          ? { image: prev.image ?? slabFrontForMint }
          : {}),
      }));
    },
    []
  );

  const certHintForPsa = useCallback((): string | undefined => {
    const num = form.grade.certNumber.trim();
    if (num) return num;
    const url = form.verification.certUrl.trim();
    return url || undefined;
  }, [form.grade.certNumber, form.verification.certUrl]);

  /**
   * Stable ref so executePsaAnalyze doesn't recreate when certNumber/certUrl change.
   * Without this, OCR populating certNumber would re-create executePsaAnalyze, causing
   * the slab useEffect to re-fire → analyzeLoading=true → Mint button perpetually disabled.
   */
  const certHintForPsaRef = useRef(certHintForPsa);
  certHintForPsaRef.current = certHintForPsa;

  const executePsaAnalyze = useCallback(
    async (front: File, back: File | null) => {
      const n = ++analyzeNonceRef.current;
      setAnalyzeError("");
      setAnalyzeLoading(true);
      try {
        const r = await analyzePsaSlab(front, back, certHintForPsaRef.current());
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
    [applyPsaAnalyzeResult], // certHintForPsa accessed via ref — no re-create on certNumber change
  );

  /** After a cert lookup: clear result and locks so the user can change cert #, then press Look up. */
  const resetCertLookupToEdit = useCallback(() => {
    analyzeNonceRef.current += 1;
    setAnalyzeLoading(false);
    setAnalyzeError("");
    setLastAnalyze(null);
    setPsaFieldLocks(EMPTY_PSA_FIELD_LOCKS);
  }, []);

  const executePsaCertLookup = useCallback(async () => {
    const hint = certHintForPsa();
    if (!hint?.trim()) {
      setAnalyzeError(
        "Enter a PSA cert number (7–10 digits) or a psacard.com/cert/… URL."
      );
      return;
    }
    const n = ++analyzeNonceRef.current;
    setAnalyzeError("");
    setAnalyzeLoading(true);
    try {
      const r = await analyzePsaByCertNumber(hint);
      if (n !== analyzeNonceRef.current) return;
      applyPsaAnalyzeResult(r);
    } catch (err: unknown) {
      if (n !== analyzeNonceRef.current) return;
      setAnalyzeError(err instanceof Error ? err.message : "Cert lookup failed");
    } finally {
      if (n === analyzeNonceRef.current) {
        setAnalyzeLoading(false);
      }
    }
  }, [applyPsaAnalyzeResult, certHintForPsa]);

  const handlePsaInputModeChange = useCallback((mode: PsaInputMode) => {
    analyzeNonceRef.current += 1;
    setPsaInputMode(mode);
    setLastAnalyze(null);
    setAnalyzeError("");
    setAnalyzeLoading(false);
    setDebounceWaiting(false);
    setPsaFieldLocks(EMPTY_PSA_FIELD_LOCKS);
  }, []);

  /** Auto-run PSA analyze when slab files change (debounced) */
  useEffect(() => {
    if (psaInputMode !== "slab") return;
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
    psaInputMode,
    form.verification.slabFront,
    form.verification.slabBack,
    // certNumber / certUrl intentionally omitted: they're read via certHintForPsaRef inside
    // executePsaAnalyze so the latest hint is always used without restarting the analyze loop.
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !address || !isConnected) return;

    setErrorMsg("");
    setStep("uploading");

    try {
      const data = new FormData();
      data.append("name", form.name);
      data.append("description", form.description.trim() || "No description");
      // Prefer clean Cardhedger catalog image (no cert label) over PSA slab photo
      const selectedMintImageUrl =
        lastAnalyze?.cardhedgerMint?.imageUrl || lastAnalyze?.psaCertImages?.front;
      if (selectedMintImageUrl) {
        data.append("imageUrl", selectedMintImageUrl);
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
            ...(meta.cardhedger ? { cardhedger: meta.cardhedger } : {}),
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
    psaInputMode === "slab" &&
    (analyzeLoading || debounceWaiting) &&
    form.verification.slabFront instanceof File;
  const certLookupAnalyzing = psaInputMode === "cert" && analyzeLoading;
  const showPsaAnalyzeOverlayRaw = slabAnalyzing || certLookupAnalyzing;

  useEffect(() => {
    if (showPsaAnalyzeOverlayRaw) {
      setAnalyzeOverlayVisible(true);
      return;
    }
    const t = window.setTimeout(() => {
      setAnalyzeOverlayVisible(false);
    }, 220);
    return () => window.clearTimeout(t);
  }, [showPsaAnalyzeOverlayRaw]);

  const showPsaAnalyzeOverlay = showPsaAnalyzeOverlayRaw || analyzeOverlayVisible;

  const friendlyMintError = useCallback((msg: string): MintFriendlyError | null => {
    const m = msg.toLowerCase();
    if (m.includes("psa 10 카드만 mint 가능합니다") || m.includes("psa 10")) {
      return {
        title: "PSA 10 only",
        message: "Minting is allowed only for cards officially verified as PSA 10.",
        hints: [
          "Re-run OCR/Cert lookup and confirm Grade is exactly 10.",
          "If the card grade is not 10, mint is intentionally blocked.",
          "Use a different cert that resolves to PSA 10.",
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
  }, []);

  /** Vault: show Mint only after slab photo is chosen, or after cert lookup completes. */
  const showMintReady =
    psaInputMode === "slab"
      ? form.verification.slabFront instanceof File
      : Boolean(lastAnalyze);

  useEffect(() => {
    if (!showPsaAnalyzeOverlay) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [showPsaAnalyzeOverlay]);

  if (step === "success" && result) {
    return (
      <div className="rounded-2xl border border-mint-deep/35 bg-[#0a0e14]/80 p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-mint/10 border border-mint/25 mb-4">
            <svg className="w-8 h-8 text-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h3 className="text-xl font-bold text-white">Asset Minted Successfully</h3>
        </div>
        <div className="space-y-3">
          <div className="bg-gray-800/50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Token URI</p>
            <p className="text-xs font-mono text-mint break-all">
              {result.tokenURI}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-4">
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
              Confirmed in block #{receipt.blockNumber.toString()}
            </p>
          )}
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-3">
          <Link
            href="/portfolio"
            className="flex w-full flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-mint to-mint-dim py-3 text-center text-sm font-bold text-mint-ink shadow-lg shadow-mint/25 transition-all hover:brightness-110"
          >
            My Assets
          </Link>
          <button
            type="button"
            onClick={resetForm}
            className="w-full flex-1 rounded-xl border border-gray-600/60 bg-gray-800/80 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700/80 sm:min-w-[10rem]"
          >
            Tokenize Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="rounded-2xl border border-gray-800 bg-[#0a0e14]/80 p-6 sm:p-8 transition-all duration-200">
      <form onSubmit={handleSubmit} className="space-y-6">
            <GradedCardSection
              gradingCompany={form.gradingCompany}
              card={form.card}
              onCardChange={updateCard}
              grade={form.grade}
              onGradeChange={updateGradePartial}
              verification={form.verification}
              onVerificationChange={updateVerification}
              psaFieldLocks={psaFieldLocks}
              psaInputMode={psaInputMode}
              onPsaInputModeChange={handlePsaInputModeChange}
              onCertLookup={() => void executePsaCertLookup()}
              onCertLookupReset={resetCertLookupToEdit}
              certLookupBusy={analyzeLoading}
              certLookupHasResult={psaInputMode === "cert" && lastAnalyze !== null}
              slotAfterHero={
                <div className="space-y-4">
        {!isConnected ? (
          <WalletConnect
            connectButtonClassName="w-full py-3.5 bg-gradient-to-r from-mint to-mint-dim hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-mint-ink text-sm font-bold rounded-xl transition-all duration-200 shadow-lg shadow-mint/25"
          />
        ) : showMintReady ? (
          <button
            type="submit"
            disabled={isProcessing || showPsaAnalyzeOverlay}
            className="w-full py-3.5 bg-gradient-to-r from-mint to-mint-dim hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-mint-ink text-sm font-bold rounded-xl transition-all duration-200 shadow-lg shadow-mint/25"
          >
            {isProcessing
              ? "Minting…"
              : showPsaAnalyzeOverlay
                ? psaInputMode === "cert"
                  ? "Looking up cert…"
                  : "Analyzing slab…"
                : "Mint"}
          </button>
        ) : null}

        {isProcessing && (
          <div className="flex items-center gap-2 py-1">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-mint border-t-transparent" />
            <span className="text-sm text-gray-400">
              {step === "uploading"
                ? "Uploading to IPFS..."
                : "Waiting for MetaMask signature..."}
            </span>
          </div>
        )}

        {step === "error" && errorMsg && (
          (() => {
            const friendly = friendlyMintError(errorMsg);
            if (!friendly) {
              return (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                  <p className="text-xs break-all text-red-400">{errorMsg}</p>
                </div>
              );
            }
            return (
              <div className="rounded-xl border border-amber-400/35 bg-amber-500/[0.10] p-3.5 sm:p-4">
                <p className="text-sm font-semibold text-amber-200">{friendly.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-amber-100/90">
                  {friendly.message}
                </p>
                <ul className="mt-2.5 list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-amber-100/80">
                  {friendly.hints.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            );
          })()
        )}

              <details className="group rounded-xl border border-gray-700/50 bg-gray-800/20 overflow-hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800/35 [&::-webkit-details-marker]:hidden">
                  <span>Mint image</span>
                  <svg
                    className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <div className="space-y-5 border-t border-gray-700/40 px-4 pb-4 pt-3 sm:px-5">
              {showPsaAnalyzeOverlay ? (
                <div className="rounded-lg border border-dashed border-gray-700/80 bg-gray-900/20 px-4 py-8 text-center">
                  <p className="text-sm text-gray-500">
                    The mint image will appear here when analysis finishes.
                  </p>
                </div>
              ) : (
                <>
              {lastAnalyze?.cardhedgerMint?.imageUrl &&
                !lastAnalyze?.psaCertImages?.front && (
                <div className="space-y-4 rounded-lg border border-gray-700/80 bg-gray-900/40 p-4 sm:p-5">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
                    <div className="mx-auto flex shrink-0 flex-col items-center lg:mx-0">
                      <div className="rounded-xl border border-gray-700 bg-[#070a0f] p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={lastAnalyze.cardhedgerMint.imageUrl}
                          alt="Cardhedger card image — RWA display image"
                          className="max-h-[min(52vh,280px)] w-auto max-w-[min(100%,280px)] object-contain rounded-lg"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center pt-0 lg:pt-2">
                      <p className="text-xs text-gray-500">
                        Cardhedger image is used because PSA cert image is unavailable.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {lastAnalyze?.psaCertImages?.front && (
                <div className="space-y-4 rounded-lg border border-gray-700/80 bg-gray-900/40 p-4 sm:p-5">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
                    <div className="mx-auto flex shrink-0 flex-col items-center lg:mx-0">
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
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-center pt-0 lg:pt-2">
                      <p className="text-xs text-gray-500">
                        PSA image is used for IPFS and marketplace art.
                      </p>
                      <span className="mt-2 inline-flex w-fit rounded-full border border-mint-deep/50 bg-mint/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-mint">
                        Source: PSA Cert Image
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!lastAnalyze?.psaCertImages?.front &&
                !lastAnalyze?.cardhedgerMint?.imageUrl &&
                form.image instanceof File &&
                mintImageBlobUrl && (
                  <div className="space-y-2 rounded-lg border border-gray-700/80 bg-gray-900/35 p-4 sm:p-5">
                    <p className="text-xs font-medium text-gray-300">Slab photo to mint image</p>
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
                !lastAnalyze?.cardhedgerMint?.imageUrl &&
                !(form.image instanceof File) &&
                !showPsaAnalyzeOverlay && (
                  <div className="rounded-lg border border-dashed border-gray-700/60 bg-gray-900/20 px-4 py-5 text-center">
                    <p className="text-xs text-gray-500">
                      {psaInputMode === "cert"
                        ? "Run cert lookup for a PSA image, or use Photo mode."
                        : "Appears here after slab analysis."}
                    </p>
                  </div>
                )}
                </>
              )}

              {errors.image && (
                <p className="text-xs text-red-400">{errors.image}</p>
              )}
                </div>
              </details>

              {analyzeError && (
                <div className="space-y-2 rounded-lg border border-gray-700/50 bg-gray-900/30 px-4 py-3">
                  <p className="text-xs text-red-400 break-words">{analyzeError}</p>
                </div>
              )}

              <details className="group rounded-xl border border-gray-700/50 bg-gray-800/20 overflow-hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800/35 [&::-webkit-details-marker]:hidden">
                  <span>Asset listing</span>
                  <svg
                    className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>
                <div className="space-y-4 border-t border-gray-700/40 px-4 pb-4 pt-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="name">
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
                className="w-full bg-gray-800/80 border border-gray-700/60 focus:border-mint rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                required
              />
              {psaFieldLocks.assetName && (
                <p className="mt-1 text-[11px] text-gray-500">
                  Set by PSA analysis
                </p>
              )}
              {errors.name && (
                <p className="mt-1 text-xs text-red-400">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2" htmlFor="description">
                Description{" "}
                <span className="text-gray-500 text-xs font-normal">(optional)</span>
              </label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                rows={2}
                placeholder="Describe your graded card..."
                className="w-full bg-gray-800/80 border border-gray-700/60 focus:border-mint rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition-colors resize-none"
              />
            </div>
                </div>
              </details>
                </div>
              }
            />
      </form>
    </div>

    {showPsaAnalyzeOverlay &&
      typeof document !== "undefined" &&
      createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px] pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="psa-analyze-overlay-title"
        >
          <div className="w-full max-w-md rounded-xl border border-gray-700/80 bg-gray-950/96 px-5 py-6 shadow-2xl shadow-black/55 sm:px-6 sm:py-7">
            <div className="flex flex-col items-center text-center">
              <div className="relative h-12 w-12 shrink-0">
                <div
                  className="absolute inset-0 rounded-full border-2 border-gray-700"
                  aria-hidden
                />
                <div
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-gray-200 border-r-gray-500 animate-spin"
                  style={{ animationDuration: "0.9s" }}
                  aria-hidden
                />
              </div>
              <p
                id="psa-analyze-overlay-title"
                className="mt-4 text-base font-semibold tracking-tight text-white sm:text-lg"
              >
                {psaInputMode === "cert" ? "Looking up PSA cert" : "Analyzing slab"}
              </p>
              <p className="mt-2 text-sm text-gray-400 max-w-[30ch]">
                {psaInputMode === "cert"
                  ? "Cardhedger and PSA official metadata lookup are running."
                  : "Cardhedger cert OCR, slab OCR, and PSA lookup are running."}
              </p>
              <div
                className="mt-4 h-2 w-full max-w-[280px] overflow-hidden rounded-full bg-gray-800/90"
                role="status"
                aria-live="polite"
                aria-label="Analysis in progress"
              >
                <div className="h-full w-full animate-pulse rounded-full bg-gradient-to-r from-gray-600 via-gray-400 to-gray-600" />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-gray-500">
                Typical time is about 30–90 seconds; slow networks can take longer. Please keep
                this tab open until it finishes.
              </p>
              <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.16em] text-gray-600">
                {psaInputMode === "cert" ? "CARDHEDGER · PSA" : "CARDHEDGER OCR · PSA"}
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
