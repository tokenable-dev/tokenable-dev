"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { uploadRwaMetadata } from "@/lib/core";
import { TOKENABLE_RWA_ADDRESS, TOKENABLE_RWA_MINT_ABI } from "@/constants/contracts";
import { sepolia } from "@/config/wagmi";
import { GAS_FALLBACK, gasWithCapFast } from "@/lib/network";
import {
  buildGradedCardMetadata,
  buildMintOpenSeaAttributes,
} from "@/lib/vault/buildMintMetadata";
import {
  MINT_FORM_INITIAL_STATE,
  type MintFormStep,
} from "@/lib/vault/mintFormConstants";
import { psaCertImageMatchesFormCert } from "@/lib/vault/mintFormPsa";
import { validateMintForm } from "@/lib/vault/validateMintForm";
import { useAppStore, selectRefresh } from "@/store";
import type { GradedCardFormState } from "@/types/gradedCard";
import { useMintFormPsaState } from "./mintFormPsaState";

export function useMintForm() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const refresh = useAppStore(selectRefresh);

  const [form, setForm] = useState<GradedCardFormState>(MINT_FORM_INITIAL_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<MintFormStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<{ tokenURI: string; txHash: string } | null>(null);
  const [mintImageBlobUrl, setMintImageBlobUrl] = useState<string | null>(null);
  /** Synchronous guard — `isProcessing` lags one React render so double-clicks can fire two mint txs. */
  const submitLockRef = useRef(false);

  const psa = useMintFormPsaState(form, setForm);

  const { writeContractAsync } = useWriteContract();
  const { data: receipt, isLoading: waitingForReceipt } =
    useWaitForTransactionReceipt({
      hash: result?.txHash as `0x${string}` | undefined,
      chainId: sepolia.id,
    });

  const updateForm = useCallback(<K extends keyof GradedCardFormState>(
    key: K,
    value: GradedCardFormState[K],
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
    [],
  );

  const updateGradePartial = useCallback(
    (grade: Partial<GradedCardFormState["grade"]>) => {
      setForm((prev) => ({ ...prev, grade: { ...prev.grade, ...grade } }));
    },
    [],
  );

  const validate = useCallback((): boolean => {
    const next = validateMintForm(form, psa.lastAnalyze, psa.psaInputMode);
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form, psa.lastAnalyze, psa.psaInputMode]);

  const resetForm = useCallback(() => {
    submitLockRef.current = false;
    setStep("idle");
    setErrorMsg("");
    setResult(null);
    psa.resetPsaState();
    setForm(MINT_FORM_INITIAL_STATE);
    setErrors({});
  }, [psa]);

  useEffect(() => {
    if (!(form.image instanceof File)) {
      setMintImageBlobUrl(null);
      return;
    }
    const u = URL.createObjectURL(form.image);
    setMintImageBlobUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [form.image]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitLockRef.current) return;
      if (!validate() || !address || !isConnected) return;

      submitLockRef.current = true;
      setErrorMsg("");
      setStep("uploading");

      try {
        const data = new FormData();
        data.append("name", form.name);
        data.append("description", form.description.trim() || "No description");
        const trustedPsaSlabUrl = psaCertImageMatchesFormCert(
          psa.lastAnalyze,
          form.grade.certNumber,
        )
          ? psa.lastAnalyze?.psaCertImages?.front
          : undefined;
        const selectedMintImageUrl =
          psa.lastAnalyze?.cardhedgerMint?.imageUrl || trustedPsaSlabUrl;
        if (selectedMintImageUrl) {
          data.append("imageUrl", selectedMintImageUrl);
        } else if (form.image instanceof File) {
          data.append("image", form.image);
        } else if (typeof form.image === "string" && form.image.trim()) {
          data.append("imageUrl", form.image);
        }

        const meta = buildGradedCardMetadata(form, psa.lastAnalyze);
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
              form.verification.certUrl ||
              psa.lastAnalyze?.psa.certVerifyUrl ||
              undefined,
          }),
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
      } finally {
        submitLockRef.current = false;
      }
    },
    [
      address,
      form,
      isConnected,
      psa.lastAnalyze,
      publicClient,
      refresh,
      validate,
      writeContractAsync,
    ],
  );

  const isProcessing = step === "uploading" || step === "minting";

  return {
    form,
    errors,
    step,
    errorMsg,
    result,
    mintImageBlobUrl,
    psa,
    updateForm,
    updateCard,
    updateVerification,
    updateGradePartial,
    resetForm,
    handleSubmit,
    isProcessing,
    waitingForReceipt,
    receipt,
    isConnected,
    address,
  };
}
