"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { analyzePsaSlab, analyzePsaByCertNumber, type PsaAnalyzeResult } from "@/lib/core";
import {
  formatPsaAnalyzeError,
  isPsaRateLimitError,
} from "@/lib/psa/psaApiErrors";
import {
  computePsaLocksFromResult,
  EMPTY_PSA_FIELD_LOCKS,
} from "@/lib/vault/mintFormPsa";
import type { PsaInputMode } from "@/lib/vault/mintFormConstants";
import type { GradedCardFormState, PsaFieldLocks } from "@/types/gradedCard";

export function useMintFormPsaState(
  form: GradedCardFormState,
  setForm: Dispatch<SetStateAction<GradedCardFormState>>,
) {
  const formRef = useRef(form);
  formRef.current = form;

  const [lastAnalyze, setLastAnalyze] = useState<PsaAnalyzeResult | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [psaRateLimitAlert, setPsaRateLimitAlert] = useState(false);
  const analyzeNonceRef = useRef(0);
  const [psaFieldLocks, setPsaFieldLocks] = useState<PsaFieldLocks>(EMPTY_PSA_FIELD_LOCKS);
  const [debounceWaiting, setDebounceWaiting] = useState(false);
  const [analyzeOverlayVisible, setAnalyzeOverlayVisible] = useState(false);
  const [psaInputMode, setPsaInputMode] = useState<PsaInputMode>("slab");

  const applyPsaAnalyzeResult = useCallback(
    (r: PsaAnalyzeResult, slabFrontForMint?: File | null) => {
      const prev = formRef.current;
      setPsaFieldLocks(computePsaLocksFromResult(r, prev));
      setPsaRateLimitAlert(false);
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
        ...(slabFrontForMint instanceof File ? { image: prev.image ?? slabFrontForMint } : {}),
      }));
    },
    [setForm],
  );

  const certHintForPsa = useCallback((): string | undefined => {
    const num = form.grade.certNumber.trim();
    if (num) return num;
    const url = form.verification.certUrl.trim();
    return url || undefined;
  }, [form.grade.certNumber, form.verification.certUrl]);

  const certHintForPsaRef = useRef(certHintForPsa);
  certHintForPsaRef.current = certHintForPsa;

  const handlePsaAnalyzeFailure = useCallback((err: unknown) => {
    if (isPsaRateLimitError(err)) {
      setAnalyzeLoading(false);
      setDebounceWaiting(false);
      setPsaRateLimitAlert(true);
      setAnalyzeError("");
      return;
    }
    setPsaRateLimitAlert(false);
    setAnalyzeError(formatPsaAnalyzeError(err));
  }, []);

  const dismissPsaRateLimitOverlay = useCallback(() => {
    setPsaRateLimitAlert(false);
    setAnalyzeOverlayVisible(false);
  }, []);

  const executePsaAnalyze = useCallback(
    async (front: File, back: File | null) => {
      const n = ++analyzeNonceRef.current;
      setAnalyzeError("");
      setPsaRateLimitAlert(false);
      setAnalyzeLoading(true);
      try {
        const r = await analyzePsaSlab(front, back, certHintForPsaRef.current());
        if (n !== analyzeNonceRef.current) return;
        applyPsaAnalyzeResult(r, front);
      } catch (err: unknown) {
        if (n !== analyzeNonceRef.current) return;
        handlePsaAnalyzeFailure(err);
      } finally {
        if (n === analyzeNonceRef.current) {
          setAnalyzeLoading(false);
        }
      }
    },
    [applyPsaAnalyzeResult, handlePsaAnalyzeFailure],
  );

  const resetCertLookupToEdit = useCallback(() => {
    analyzeNonceRef.current += 1;
    setAnalyzeLoading(false);
    setAnalyzeError("");
    setPsaRateLimitAlert(false);
    setLastAnalyze(null);
    setPsaFieldLocks(EMPTY_PSA_FIELD_LOCKS);
  }, []);

  const executePsaCertLookup = useCallback(async () => {
    const hint = certHintForPsa();
    if (!hint?.trim()) {
      setAnalyzeError("Enter a PSA cert number (7–10 digits) or a psacard.com/cert/… URL.");
      return;
    }
    const n = ++analyzeNonceRef.current;
    setAnalyzeError("");
    setPsaRateLimitAlert(false);
    setAnalyzeLoading(true);
    try {
      const r = await analyzePsaByCertNumber(hint);
      if (n !== analyzeNonceRef.current) return;
      applyPsaAnalyzeResult(r);
    } catch (err: unknown) {
      if (n !== analyzeNonceRef.current) return;
      handlePsaAnalyzeFailure(err);
    } finally {
      if (n === analyzeNonceRef.current) {
        setAnalyzeLoading(false);
      }
    }
  }, [applyPsaAnalyzeResult, certHintForPsa, handlePsaAnalyzeFailure]);

  const handlePsaInputModeChange = useCallback((mode: PsaInputMode) => {
    analyzeNonceRef.current += 1;
    setPsaInputMode(mode);
    setLastAnalyze(null);
    setAnalyzeError("");
    setPsaRateLimitAlert(false);
    setAnalyzeLoading(false);
    setDebounceWaiting(false);
    setPsaFieldLocks(EMPTY_PSA_FIELD_LOCKS);
  }, []);

  const resetPsaState = useCallback(() => {
    setLastAnalyze(null);
    setAnalyzeError("");
    setPsaRateLimitAlert(false);
    analyzeNonceRef.current += 1;
    setPsaFieldLocks(EMPTY_PSA_FIELD_LOCKS);
    setPsaInputMode("slab");
  }, []);

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
    setAnalyzeLoading(true);
    setDebounceWaiting(true);
    const back =
      form.verification.slabBack instanceof File ? form.verification.slabBack : null;
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
    executePsaAnalyze,
  ]);

  const slabAnalyzing =
    psaInputMode === "slab" &&
    !psaRateLimitAlert &&
    (analyzeLoading || debounceWaiting) &&
    form.verification.slabFront instanceof File;
  const certLookupAnalyzing =
    psaInputMode === "cert" && analyzeLoading && !psaRateLimitAlert;
  const showPsaAnalyzeOverlayRaw =
    psaRateLimitAlert || slabAnalyzing || certLookupAnalyzing;

  useEffect(() => {
    if (showPsaAnalyzeOverlayRaw) {
      setAnalyzeOverlayVisible(true);
      return;
    }
    const t = window.setTimeout(() => setAnalyzeOverlayVisible(false), 220);
    return () => window.clearTimeout(t);
  }, [showPsaAnalyzeOverlayRaw]);

  const showPsaAnalyzeOverlay = showPsaAnalyzeOverlayRaw || analyzeOverlayVisible;

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

  return {
    lastAnalyze,
    analyzeLoading,
    analyzeError,
    psaRateLimitAlert,
    psaFieldLocks,
    psaInputMode,
    showPsaAnalyzeOverlay,
    showMintReady,
    dismissPsaRateLimitOverlay,
    executePsaCertLookup,
    resetCertLookupToEdit,
    handlePsaInputModeChange,
    resetPsaState,
    certLookupHasResult: psaInputMode === "cert" && lastAnalyze !== null,
  };
}
