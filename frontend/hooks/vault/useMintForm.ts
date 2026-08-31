"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccessGate } from "@/hooks/auth/useAccessGate";
import { useAccountWalletSession } from "@/hooks/auth/useAccountWalletSession";
import { useEnsureAccountWalletReady } from "@/hooks/auth/useEnsureAccountWalletReady";
import {
  certMintBlockReason,
  uploadRwaMetadata,
  mintRwaViaBackend,
  syncRwaTokenAfterMint,
} from "@/lib/core";
import { invalidateAfterRwaMintTx } from "@/lib/core/invalidation";
import {
  buildGradedCardMetadata,
  buildMintOpenSeaAttributes,
} from "@/lib/vault/buildMintMetadata";
import {
  MINT_FORM_INITIAL_STATE,
  type MintFormStep,
} from "@/lib/vault/mintFormConstants";
import { resolveSelfVaultMintImageSelection } from "@/lib/vault/mintImageSource";
import { validateMintForm } from "@/lib/vault/validateMintForm";
import { normalizeWalletAddress } from "@/lib/auth/wallets";
import { useAppChain } from "@/providers/AppChainProvider";
import { useAppStore, selectRefresh } from "@/store";
import type { GradedCardFormState } from "@/types/gradedCard";
import { useMintFormPsaState } from "./mintFormPsaState";

export function useMintForm() {
  const { primaryAddress, isWalletReady, isWalletActivating, hasAccountWallet, isWalletAwaitingPrivy } =
    useAccountWalletSession();
  const ensureAccountWalletReady = useEnsureAccountWalletReady();
  const { chainId } = useAppChain();
  const { runAccessGate } = useAccessGate(2, "/vault/submit/mint");
  const refresh = useAppStore(selectRefresh);
  const queryClient = useQueryClient();

  const [form, setForm] = useState<GradedCardFormState>(MINT_FORM_INITIAL_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<MintFormStep>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<{
    tokenURI: string;
    txHash: string;
    tokenId: number;
  } | null>(null);
  const [mintImageBlobUrl, setMintImageBlobUrl] = useState<string | null>(null);
  /** Synchronous guard — `isProcessing` lags one React render so double-clicks can fire two mint txs. */
  const submitLockRef = useRef(false);
  const [walletActivateError, setWalletActivateError] = useState("");
  const [walletActivateBusy, setWalletActivateBusy] = useState(false);
  const [certTakenMessage, setCertTakenMessage] = useState<string | null>(null);
  const [certTakenChecking, setCertTakenChecking] = useState(false);

  const psa = useMintFormPsaState(form, setForm);

  const resolvedCert = (
    form.grade.certNumber.trim() ||
    psa.lastAnalyze?.psa.certNumber?.trim() ||
    ""
  );

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

  useEffect(() => {
    if (!/^\d{7,10}$/.test(resolvedCert)) {
      setCertTakenMessage(null);
      setCertTakenChecking(false);
      return;
    }
    let cancelled = false;
    setCertTakenChecking(true);
    void certMintBlockReason(resolvedCert, chainId)
      .then((reason) => {
        if (!cancelled) setCertTakenMessage(reason);
      })
      .catch(() => {
        if (!cancelled) setCertTakenMessage(null);
      })
      .finally(() => {
        if (!cancelled) setCertTakenChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedCert, chainId]);

  const validate = useCallback((): boolean => {
    const next = validateMintForm(form, psa.lastAnalyze, psa.psaInputMode);
    if (certTakenMessage) next.certNumber = certTakenMessage;
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form, psa.lastAnalyze, psa.psaInputMode, certTakenMessage]);

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

  useEffect(() => {
    if (isWalletReady || !hasAccountWallet) return;
    let cancelled = false;
    void ensureAccountWalletReady()
      .then(() => {
        if (!cancelled) setWalletActivateError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Could not activate account wallet.";
        setWalletActivateError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [isWalletReady, hasAccountWallet, ensureAccountWalletReady, primaryAddress]);

  const activateAccountWallet = useCallback(async () => {
    setWalletActivateError("");
    setWalletActivateBusy(true);
    try {
      await ensureAccountWalletReady();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not activate account wallet.";
      setWalletActivateError(message);
    } finally {
      setWalletActivateBusy(false);
    }
  }, [ensureAccountWalletReady]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitLockRef.current) return;
      if (!validate() || !primaryAddress || !isWalletReady) return;
      if (certTakenMessage) return;
      if (!runAccessGate()) return;

      const certForMint =
        form.grade.certNumber.trim() ||
        psa.lastAnalyze?.psa.certNumber?.trim() ||
        "";
      if (certForMint) {
        const taken = await certMintBlockReason(certForMint, chainId);
        if (taken) {
          setCertTakenMessage(taken);
          setErrorMsg(taken);
          setStep("error");
          submitLockRef.current = false;
          return;
        }
      }

      submitLockRef.current = true;
      setErrorMsg("");
      setStep("uploading");

      try {
        const recipientAddress = await ensureAccountWalletReady();
        if (normalizeWalletAddress(recipientAddress) !== primaryAddress) {
          throw new Error("Mint must use your Privy account wallet.");
        }
        const data = new FormData();
        data.append("name", form.name);
        data.append("description", form.description.trim() || "No description");
        const mintImage = resolveSelfVaultMintImageSelection({
          analyze: psa.lastAnalyze,
          certNumber: form.grade.certNumber,
          userImage: form.image,
        });
        if (mintImage.imageUrl) {
          data.append("imageUrl", mintImage.imageUrl);
        } else if (mintImage.useUserFile && form.image instanceof File) {
          data.append("image", form.image);
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

        const uploadResult = await uploadRwaMetadata(data, chainId);
        setStep("minting");

        // Permanent physical-asset identity — must match what buildGradedCardMetadata()
        // wrote into properties.graded.psa.certNumber so the on-chain vaultRef the
        // backend derives stays stable across this card's future vault cycles.
        const certNumber =
          form.grade.certNumber.trim() || psa.lastAnalyze?.psa.certNumber?.trim() || "";

        const mintResult = await mintRwaViaBackend({
          recipientAddress: primaryAddress,
          tokenURI: uploadResult.tokenURI,
          certNumber,
          chainId,
          displayImageUrl: uploadResult.displayImageUrl,
        });

        setResult({
          tokenURI: uploadResult.tokenURI,
          txHash: mintResult.txHash,
          tokenId: mintResult.tokenId,
        });
        setStep("success");

        await syncRwaTokenAfterMint(mintResult.tokenId);
        await invalidateAfterRwaMintTx(queryClient, {
          tokenId: mintResult.tokenId,
          address: primaryAddress,
        });
        refresh();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred";
        setErrorMsg(message);
        setStep("error");
        submitLockRef.current = false;
      }
    },
    [
      primaryAddress,
      form,
      isWalletReady,
      ensureAccountWalletReady,
      psa.lastAnalyze,
      queryClient,
      refresh,
      validate,
      certTakenMessage,
      runAccessGate,
      chainId,
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
    isWalletReady,
    isWalletActivating,
    isWalletAwaitingPrivy,
    hasAccountWallet,
    walletActivateError,
    walletActivateBusy,
    activateAccountWallet,
    address: primaryAddress,
    certTakenMessage,
    certTakenChecking,
  };
}
