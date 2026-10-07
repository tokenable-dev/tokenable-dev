"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cardDisplayNameFromPsaAnalyze,
  classifyPartnerCsvLookupError,
  PARTNER_PSA_GRADE_REJECT_MESSAGE,
  partnerCsvLookupErrorFromUnknown,
  type PartnerCsvErrorKind,
} from "@/lib/sell/partnerCsvLookup";
import {
  analyzePsaByCertNumber,
  analyzePsaSlab,
  certMintBlockReason,
  getPartnerMe,
  listVaultSubmissions,
  rq,
  type PsaAnalyzeResult,
} from "@/lib/core";
import {
  resolveSelfVaultMintImageSelection,
} from "@/lib/vault/mintImageSource";
import { invalidateAfterRwaMintTx } from "@/lib/core/invalidation";
import { fetchAuthMe } from "@/lib/auth";
import { fetchKycStatus } from "@/lib/kyc/api";
import { rememberKycReturnTo } from "@/lib/kyc/returnPath";
import type { KycStatus } from "@/lib/auth";
import {
  canUseSellCertDirectInput,
  isKycComplete,
} from "@/lib/auth/accountAccess";
import {
  formatPsaAnalyzeError,
  isPsaRateLimitError,
} from "@/lib/psa/psaApiErrors";
import { useAccessGate } from "@/hooks/auth/useAccessGate";
import { useEnsureAccountWalletReady } from "@/hooks/auth/useEnsureAccountWalletReady";
import {
  draftCardsFromSubmissionItems,
  bindSellFlowToContract,
  bindSellFlowToUser,
  consumeSellFlowResumeCards,
  readSellFlowDraftCards,
  readSellFlowProgress,
  clearSellSubmissionPublicId,
  sellDraftCardFieldsFromPsaAnalyze,
  writeSellFlowDraftCards,
  writeSellFlowProgress,
  writeSellSubmissionPublicId,
  type SellDraftCard,
  type SellVaultChoice,
} from "@/lib/sell/sellFlowDraft";
import {
  classifyPartnerMintSkip,
  type PartnerMintBatchResult,
  type PartnerMintSucceeded,
} from "@/lib/sell/mintSellFlowCard";
import {
  clearPartnerVaultMintJobId,
  createPartnerVaultMintJob,
  getPartnerVaultMintJob,
  persistPartnerVaultMintJobId,
  readPartnerVaultMintJobId,
  type PartnerVaultMintJobView,
} from "@/lib/sell/partnerVaultMintJob";
import { useAppChain } from "@/providers/AppChainProvider";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

export type SellFlowScreen = "register" | "vault" | "cards";

/** Legacy key — consents are session-only now; cleared on hydrate. */
const CONSENTS_KEY = "tk_seller_consents";
const MAX_CARDS = 99;

export type SellFlowCard = SellDraftCard;

export type SlabPhotoIngestResult =
  | { ok: true; fileName: string; name: string; cert: string }
  | { ok: false; fileName: string; error: string };

function isSlabUploadImageFile(file: File): boolean {
  const t = file.type.toLowerCase();
  return (
    t === "image/jpeg" ||
    t === "image/jpg" ||
    t === "image/png" ||
    t === "image/webp"
  );
}

export type SellConsents = {
  terms: boolean;
  authenticity: boolean;
  storage: boolean;
  fee: boolean;
  marketing: boolean;
};

const EMPTY_CONSENTS: SellConsents = {
  terms: false,
  authenticity: false,
  storage: false,
  fee: false,
  marketing: false,
};

function cardFromAnalyze(
  r: PsaAnalyzeResult,
  certFallback: string,
  uploadPreviewDataUrl?: string | null,
): SellFlowCard | { error: string } {
  const cert = (r.psa.certNumber ?? certFallback).trim();
  const grade = r.psa.gradeScore;
  if (grade !== 9 && grade !== 10) {
    return { error: PARTNER_PSA_GRADE_REJECT_MESSAGE };
  }
  const mintImage = resolveSelfVaultMintImageSelection({
    analyze: r,
    certNumber: cert,
    userImage: uploadPreviewDataUrl,
  });
  const img =
    mintImage.source === "user_upload" && uploadPreviewDataUrl?.trim()
      ? uploadPreviewDataUrl.trim()
      : mintImage.previewUrl;
  const displayFields = sellDraftCardFieldsFromPsaAnalyze(r);
  return {
    cert,
    name: displayFields.name,
    grade,
    img,
    confirmed: true,
    cardNumber: displayFields.cardNumber,
    year: displayFields.year,
    setName: displayFields.setName,
    variant: displayFields.variant,
    language: displayFields.language,
  };
}

/** Compact JPEG data URL so draft localStorage can keep a thumb when PSA/CH have none. */
async function fileToThumbDataUrl(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxW = 480;
    const scale = Math.min(1, maxW / Math.max(1, bitmap.width));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }
}

function mapKycToIdState(
  user: Parameters<typeof isKycComplete>[0],
  status: KycStatus | undefined,
): "idle" | "review" | "verified" | "failed" {
  if (isKycComplete(user) || status === "approved") return "verified";
  if (status === "pending" || user?.kycStatus === "pending") return "review";
  if (status === "rejected" || user?.kycStatus === "rejected") return "failed";
  return "idle";
}

export function useSellFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const authInitialized = useAuthStore((s) => s.initialized);
  const setUser = useAuthStore((s) => s.setUser);
  const { chainId } = useAppChain();
  const ensureAccountWalletReady = useEnsureAccountWalletReady();
  const { runAccessGate } = useAccessGate(2, "/sell/flow");
  const queryClient = useQueryClient();

  const [screen, setScreen] = useState<SellFlowScreen>("register");
  const [vaultChoice, setVaultChoice] = useState<SellVaultChoice | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [kycStatus, setKycStatus] = useState<KycStatus | undefined>(
    user?.kycStatus === "approved" || isKycComplete(user) ? "approved" : user?.kycStatus,
  );
  const [kycLoading, setKycLoading] = useState(false);
  const [consents, setConsents] = useState<SellConsents>(EMPTY_CONSENTS);
  const [cards, setCards] = useState<SellFlowCard[]>([]);
  const cardsRef = useRef<SellFlowCard[]>(cards);
  cardsRef.current = cards;
  const [certInput, setCertInput] = useState("");
  const [certError, setCertError] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [draftSavedFlash, setDraftSavedFlash] = useState(false);
  const [mintBusy, setMintBusy] = useState(false);
  const [mintStatus, setMintStatus] = useState<string | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);
  const [partnerMintSuccess, setPartnerMintSuccess] =
    useState<PartnerMintBatchResult | null>(null);
  const [vaultMintJob, setVaultMintJob] =
    useState<PartnerVaultMintJobView | null>(null);
  const slabInputRef = useRef<HTMLInputElement>(null);
  const lookupLockRef = useRef(false);
  const mintLockRef = useRef(false);
  const vaultMintJobAppliedRef = useRef<string | null>(null);
  /** Session-only slab Files by cert — used for mint when PSA has no official slab. */
  const slabFileByCertRef = useRef<Map<string, File>>(new Map());
  const psaAnalyzeByCertRef = useRef<Map<string, PsaAnalyzeResult>>(new Map());
  const localHydrateDoneRef = useRef(false);
  const hydrateDoneRef = useRef(false);

  const idState = mapKycToIdState(user, kycStatus ?? user?.kycStatus);

  // Bind draft keys to the signed-in user before any local restore (blocks cross-account OCR leaks).
  useEffect(() => {
    if (!authInitialized) return;
    const wiped =
      bindSellFlowToUser(user?.id ?? null) || bindSellFlowToContract();
    if (wiped && user?.id) bindSellFlowToUser(user.id);
    if (!wiped) return;
    setCards([]);
    slabFileByCertRef.current.clear();
    psaAnalyzeByCertRef.current.clear();
    setDraftRestored(false);
    setVaultChoice(null);
    hydrateDoneRef.current = false;
    localHydrateDoneRef.current = false;
  }, [authInitialized, user?.id]);

  // Local restore — draft cards only. Always open register (seller terms each
  // visit). Optional `?vault=self|psa` prefills vault after Continue.
  useEffect(() => {
    if (!authInitialized) return;
    if (localHydrateDoneRef.current) return;
    localHydrateDoneRef.current = true;
    if (user?.id) bindSellFlowToUser(user.id);
    bindSellFlowToContract();
    const localCards = user?.id ? readSellFlowDraftCards() : [];
    const q = searchParams.get("vault");
    const prefillsVault: SellVaultChoice | null =
      q === "self" || q === "psa" ? q : null;
    const resumeCards = consumeSellFlowResumeCards() && localCards.length > 0;
    setCards(localCards);
    if (resumeCards) {
      const saved = readSellFlowProgress().vaultChoice;
      const choice: SellVaultChoice = saved === "self" ? "self" : "psa";
      setVaultChoice(choice);
      setScreen("cards");
      writeSellFlowProgress({ step: "cards", vaultChoice: choice });
    } else {
      setVaultChoice(prefillsVault);
      setScreen("register");
      writeSellFlowProgress({
        step: "register",
        vaultChoice: prefillsVault,
      });
    }
    setConsents({ ...EMPTY_CONSENTS });
    try {
      localStorage.removeItem(CONSENTS_KEY);
    } catch {
      /* ignore */
    }
    if (localCards.length > 0) {
      setDraftRestored(true);
    }
    setHydrated(true);
  }, [authInitialized, user?.id, searchParams]);

  useEffect(() => {
    setKycStatus(user?.kycStatus);
  }, [user?.kycStatus]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setKycLoading(true);
    void (async () => {
      try {
        const me = await fetchAuthMe();
        if (!cancelled && me) setUser(me);
        const s = await fetchKycStatus();
        if (!cancelled) setKycStatus(s.status);
      } catch {
        /* keep session KYC */
      } finally {
        if (!cancelled) setKycLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, setUser]);

  /**
   * Pre-ship cards live in localStorage only — do not hydrate from status=draft.
   * If an awaiting_shipment package already exists (left mid-ship), remember its
   * publicId and soft-fill cards only when local is empty so shipping can resume.
   */
  useEffect(() => {
    if (!user?.id || !hydrated || hydrateDoneRef.current) return;
    hydrateDoneRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listVaultSubmissions();
        if (cancelled) return;
        const openShip = rows.find((s) => s.status === "awaiting_shipment");
        if (!openShip) {
          clearSellSubmissionPublicId();
          return;
        }

        writeSellSubmissionPublicId(openShip.publicId);
        if (openShip.packingSlipDownloadedAt) {
          writeSellFlowProgress({ slipDownloaded: true });
        }

        const localCards = readSellFlowDraftCards();
        if (localCards.length > 0) return;

        const serverCards = draftCardsFromSubmissionItems(openShip.items);
        if (serverCards.length === 0) return;
        writeSellFlowDraftCards(serverCards);
        setCards(serverCards);
        setDraftRestored(true);
        writeSellFlowProgress({
          step: "shipping-pack",
          vaultChoice: "psa",
          slipDownloaded: Boolean(openShip.packingSlipDownloadedAt),
        });
      } catch {
        /* offline — local draft still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, hydrated]);

  const requiredConsentsOk = useMemo(
    () => consents.terms && consents.authenticity && consents.storage,
    [consents],
  );

  const allConsentsOn = requiredConsentsOk;

  const canContinueRegister = idState === "verified" && requiredConsentsOk;

  /*
   * Same session as PartnerGate (`GET /marketplace/partners/me`): any linked
   * wallet may match the partner row. Wallet-only eligibility missed that and
   * was also disabled on the cards screen after refresh → false "partners only".
   */
  const selfVaultEligibilityQuery = useQuery({
    queryKey: rq.partnerMe(),
    queryFn: getPartnerMe,
    enabled:
      Boolean(user) && (screen === "vault" || vaultChoice === "self"),
    staleTime: 60_000,
    refetchOnMount: "always",
  });

  const selfVaultIsPartner = Boolean(selfVaultEligibilityQuery.data?.isPartner);
  const selfVaultEligible = Boolean(
    selfVaultIsPartner && selfVaultEligibilityQuery.data?.hasCompanyAddress,
  );
  const selfVaultNeedsCompanyAddress =
    selfVaultIsPartner &&
    selfVaultEligibilityQuery.data?.hasCompanyAddress === false;
  const selfVaultPartnerOnly =
    vaultChoice === "self" &&
    !selfVaultEligibilityQuery.isLoading &&
    Boolean(user) &&
    !selfVaultEligible &&
    !selfVaultNeedsCompanyAddress;

  const canContinueVault =
    vaultChoice === "psa" ||
    (vaultChoice === "self" && selfVaultEligible);
  const canContinueShipping = cards.some((c) => c.confirmed);

  // Do not auto-advance when consents become valid — user must press Continue.
  // Draft cards / progress stay local until shipping (no vault_submissions draft rows).

  const updateConsent = useCallback((key: keyof SellConsents | "all") => {
    setConsents((prev) => {
      if (key === "all") {
        const turnOn = !(prev.terms && prev.authenticity && prev.storage);
        return {
          ...prev,
          terms: turnOn,
          authenticity: turnOn,
          storage: turnOn,
        };
      }
      const next = { ...prev, [key]: !prev[key] };
      return next;
    });
  }, []);

  const startVerification = useCallback(() => {
    rememberKycReturnTo("/sell/flow");
    useAuthUiStore.getState().setPendingReturnTo("/sell/flow");
    useAuthUiStore.setState({ kycOpen: false });
    router.push("/kyc");
  }, [router]);

  /**
   * Register Continue → vault, unless `?vault=` already prefilled a choice
   * (then cards). Back from vault clears that choice so Continue cannot skip.
   */
  const goToVault = useCallback(() => {
    if (!canContinueRegister) return;
    if (vaultChoice === "self" || vaultChoice === "psa") {
      writeSellFlowProgress({ step: "cards", vaultChoice });
      setScreen("cards");
    } else {
      writeSellFlowProgress({ step: "vault", vaultChoice: null });
      setScreen("vault");
    }
    window.scrollTo(0, 0);
  }, [canContinueRegister, vaultChoice]);

  const goToCards = useCallback(() => {
    if (!canContinueRegister) return;
    writeSellFlowProgress({ step: "cards", vaultChoice: vaultChoice ?? "psa" });
    setScreen("cards");
    window.scrollTo(0, 0);
  }, [canContinueRegister, vaultChoice]);

  const goToRegister = useCallback(() => {
    setVaultChoice(null);
    writeSellFlowProgress({ step: "register", vaultChoice: null });
    setScreen("register");
    window.scrollTo(0, 0);
  }, []);

  const goBackToVaultChoice = useCallback(() => {
    writeSellFlowProgress({ step: "vault" });
    setScreen("vault");
    window.scrollTo(0, 0);
  }, []);

  const selectVault = useCallback((choice: SellVaultChoice) => {
    setVaultChoice(choice);
    writeSellFlowProgress({ step: "vault", vaultChoice: choice });
  }, []);

  const continueFromVault = useCallback(() => {
    if (!vaultChoice) return;
    if (vaultChoice === "self" && !selfVaultEligible) return;
    writeSellFlowProgress({
      step: "cards",
      vaultChoice: vaultChoice === "self" ? "self" : "psa",
    });
    setScreen("cards");
    window.scrollTo(0, 0);
  }, [vaultChoice, selfVaultEligible]);

  const addCardFromResult = useCallback(
    (
      r: PsaAnalyzeResult,
      certFallback: string,
      uploadPreviewDataUrl?: string | null,
      slabFile?: File | null,
      opts?: { silent?: boolean },
    ) => {
      const built = cardFromAnalyze(r, certFallback, uploadPreviewDataUrl);
      if ("error" in built) {
        if (!opts?.silent) setCertError(built.error);
        return false;
      }
      const current = cardsRef.current;
      if (current.length >= MAX_CARDS) {
        if (!opts?.silent) {
          setCertError("You can add up to 99 cards per submission.");
        }
        return false;
      }
      if (current.some((c) => c.cert === built.cert)) {
        if (!opts?.silent) {
          setCertError("That card is already in your list.");
        }
        return false;
      }
      if (slabFile) {
        slabFileByCertRef.current.set(built.cert, slabFile);
      }
      psaAnalyzeByCertRef.current.set(built.cert, r);
      setCards((prev) => {
        const next = [...prev, built];
        cardsRef.current = next;
        return next;
      });
      setCertInput("");
      if (!opts?.silent) setCertError(null);
      return true;
    },
    [],
  );

  const ingestSlabPhoto = useCallback(
    async (file: File): Promise<SlabPhotoIngestResult> => {
      const fileName = file.name || "slab.jpg";
      if (!isSlabUploadImageFile(file)) {
        return {
          ok: false,
          fileName,
          error: "Use JPEG, PNG, or WebP (max 10 MB). HEIC is not supported.",
        };
      }
      if (cardsRef.current.length >= MAX_CARDS) {
        return {
          ok: false,
          fileName,
          error: "You can add up to 99 cards per submission.",
        };
      }
      try {
        const [uploadPreview, r] = await Promise.all([
          fileToThumbDataUrl(file),
          analyzePsaSlab(file),
        ]);
        const cert = r.psa.certNumber?.trim() ?? "";
        if (!cert) {
          return {
            ok: false,
            fileName,
            error:
              "Could not read a cert number from this photo. Use a clear PSA slab label or enter the cert manually.",
          };
        }
        const taken = await certMintBlockReason(cert, chainId);
        if (taken) {
          return { ok: false, fileName, error: taken };
        }
        const preview = cardFromAnalyze(r, cert, uploadPreview);
        if ("error" in preview) {
          return { ok: false, fileName, error: preview.error };
        }
        const added = addCardFromResult(r, cert, uploadPreview, file, {
          silent: true,
        });
        if (!added) {
          if (cardsRef.current.some((c) => c.cert === preview.cert)) {
            return { ok: false, fileName, error: "Already in your list." };
          }
          return {
            ok: false,
            fileName,
            error: "Could not add this card to your list.",
          };
        }
        return { ok: true, fileName, name: preview.name, cert: preview.cert };
      } catch (e) {
        if (isPsaRateLimitError(e)) {
          return {
            ok: false,
            fileName,
            error: "PSA rate limit reached. Please wait and try again later.",
          };
        }
        return {
          ok: false,
          fileName,
          error: formatPsaAnalyzeError(e),
        };
      }
    },
    [addCardFromResult, chainId],
  );

  const lookupCert = useCallback(async () => {
    if (lookupLockRef.current) return;
    const cert = certInput.trim();
    setCertError(null);
    if (!/^\d{7,10}$/.test(cert)) {
      setCertError("Enter a valid PSA cert number (7–10 digits).");
      return;
    }
    if (cards.length >= MAX_CARDS) {
      setCertError("You can add up to 99 cards per submission.");
      return;
    }
    if (cards.some((c) => c.cert === cert)) {
      setCertError("That card is already in your list.");
      return;
    }
    lookupLockRef.current = true;
    setLookupBusy(true);
    try {
      const taken = await certMintBlockReason(cert, chainId);
      if (taken) {
        setCertError(taken);
        return;
      }
      const r = await analyzePsaByCertNumber(cert);
      addCardFromResult(r, cert);
    } catch (e) {
      if (isPsaRateLimitError(e)) {
        setCertError(
          "PSA rate limit reached. Please wait and try again later.",
        );
      } else {
        setCertError(
          e instanceof Error
            ? e.message
            : "We couldn’t find that cert number. Check the number on the slab.",
        );
      }
    } finally {
      lookupLockRef.current = false;
      setLookupBusy(false);
    }
  }, [addCardFromResult, cards, certInput, vaultChoice, chainId]);

  /** Cert lookup for bulk CSV rows (no cert input field). */
  const lookupCertByNumber = useCallback(
    async (
      certRaw: string,
    ): Promise<
      | { ok: true; name: string }
      | { ok: false; errorKind: PartnerCsvErrorKind; name?: string }
    > => {
      const cert = certRaw.trim();
      if (!/^\d{7,10}$/.test(cert)) {
        return { ok: false, errorKind: "invalid_cert" };
      }
      if (cards.length >= MAX_CARDS) {
        return { ok: false, errorKind: "list_full" };
      }
      if (cards.some((c) => c.cert === cert)) {
        return { ok: false, errorKind: "duplicate" };
      }
      try {
        const r = await analyzePsaByCertNumber(cert);
        const displayName = cardDisplayNameFromPsaAnalyze(r);

        const taken = await certMintBlockReason(cert, chainId);
        if (taken) {
          return {
            ok: false,
            errorKind: classifyPartnerCsvLookupError(taken),
            name: displayName,
          };
        }

        const preview = cardFromAnalyze(r, cert);
        if ("error" in preview) {
          return {
            ok: false,
            errorKind: classifyPartnerCsvLookupError(preview.error),
            name: displayName,
          };
        }
        if (!addCardFromResult(r, cert)) {
          if (cards.some((c) => c.cert === preview.cert)) {
            return { ok: false, errorKind: "duplicate", name: displayName };
          }
          if (cards.length >= MAX_CARDS) {
            return { ok: false, errorKind: "list_full", name: displayName };
          }
          return { ok: false, errorKind: "add_failed", name: displayName };
        }
        return { ok: true, name: preview.name };
      } catch (e) {
        if (isPsaRateLimitError(e)) {
          return { ok: false, errorKind: "rate_limit" };
        }
        return {
          ok: false,
          errorKind: partnerCsvLookupErrorFromUnknown(e),
        };
      }
    },
    [addCardFromResult, cards, chainId],
  );

  const scanSlab = useCallback(() => {
    slabInputRef.current?.click();
  }, []);

  const onSlabFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setCertError(null);
      if (cardsRef.current.length >= MAX_CARDS) {
        setCertError("You can add up to 99 cards per submission.");
        return;
      }
      lookupLockRef.current = true;
      setLookupBusy(true);
      try {
        const result = await ingestSlabPhoto(file);
        if (!result.ok) {
          setCertError(result.error);
        }
      } finally {
        lookupLockRef.current = false;
        setLookupBusy(false);
        if (slabInputRef.current) slabInputRef.current.value = "";
      }
    },
    [ingestSlabPhoto],
  );

  const uploadSlabPhotos = useCallback(
    async (
      files: File[],
      onProgress?: (index: number, total: number, fileName: string) => void,
    ): Promise<SlabPhotoIngestResult[]> => {
      if (lookupLockRef.current || files.length === 0) return [];
      lookupLockRef.current = true;
      setLookupBusy(true);
      setCertError(null);
      const outcomes: SlabPhotoIngestResult[] = [];
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]!;
          const fileName = file.name || "slab.jpg";
          onProgress?.(i, files.length, fileName);
          if (cardsRef.current.length >= MAX_CARDS) {
            outcomes.push({
              ok: false,
              fileName,
              error: "You can add up to 99 cards per submission.",
            });
            continue;
          }
          outcomes.push(await ingestSlabPhoto(file));
        }
      } finally {
        lookupLockRef.current = false;
        setLookupBusy(false);
        if (slabInputRef.current) slabInputRef.current.value = "";
      }
      return outcomes;
    },
    [ingestSlabPhoto],
  );

  const toggleConfirm = useCallback((index: number) => {
    setCards((prev) =>
      prev.map((c, i) =>
        i === index ? { ...c, confirmed: !c.confirmed } : c,
      ),
    );
  }, []);

  const setAllConfirmed = useCallback((confirmed: boolean) => {
    setCards((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((c) =>
        c.confirmed === confirmed ? c : { ...c, confirmed },
      );
    });
  }, []);

  const removeCard = useCallback((index: number) => {
    setCards((prev) => {
      const removed = prev[index];
      if (removed?.cert) {
        slabFileByCertRef.current.delete(removed.cert);
        psaAnalyzeByCertRef.current.delete(removed.cert);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  /** Local-only — does not create vault_submissions rows. */
  const saveDraft = useCallback(() => {
    writeSellFlowDraftCards(cards);
    writeSellFlowProgress({
      step: "cards",
      ...(vaultChoice === "self" || vaultChoice === "psa"
        ? { vaultChoice }
        : {}),
    });
    setDraftSavedFlash(true);
    window.setTimeout(() => setDraftSavedFlash(false), 1800);
  }, [cards, vaultChoice]);

  const continueToShipping = useCallback(async () => {
    if (!canContinueShipping) return;
    if (vaultChoice === "self") return;
    const confirmed = cards.filter((c) => c.confirmed);
    for (const card of confirmed) {
      const taken = await certMintBlockReason(card.cert, chainId);
      if (taken) {
        setCertError(taken);
        return;
      }
    }
    writeSellFlowDraftCards(cards);
    writeSellFlowProgress({ step: "shipping-pack", vaultChoice: "psa" });
    // First vault_submissions write happens on /sell/shipping (awaiting_shipment).
    router.push("/sell/shipping");
  }, [canContinueShipping, cards, router, vaultChoice, chainId]);

  /** Partner vault: mint confirmed cards directly to the user's portfolio wallet. */
  const continueToSelfMint = useCallback(async () => {
    if (vaultChoice !== "self" || !canContinueShipping) return;
    if (!selfVaultEligible) {
      if (selfVaultNeedsCompanyAddress) {
        setMintError(
          "Partner vault requires a company vault address — set it in Settings → Addresses.",
        );
      } else {
        setMintError(
          "Partner vault is available only to contracted Tokenable partners.",
        );
      }
      return;
    }
    if (mintLockRef.current) return;
    if (!runAccessGate()) return;

    const confirmed = cards.filter((c) => c.confirmed);
    if (confirmed.length === 0) return;

    mintLockRef.current = true;
    setMintBusy(true);
    setMintError(null);
    setMintStatus(null);

    try {
      const recipientAddress = await ensureAccountWalletReady();
      const job = await createPartnerVaultMintJob(
        confirmed.map((c) => c.cert),
        chainId,
        recipientAddress,
      );
      persistPartnerVaultMintJobId(job.id);
      setVaultMintJob(job);
      setMintStatus(
        job.itemCount > 0
          ? `Minting ${job.processedCount}/${job.itemCount}…`
          : null,
      );
    } catch (e) {
      setMintError(
        e instanceof Error ? e.message : "Partner vault mint failed",
      );
      setMintStatus(null);
      mintLockRef.current = false;
      setMintBusy(false);
    }
  }, [
    vaultChoice,
    canContinueShipping,
    selfVaultEligible,
    selfVaultNeedsCompanyAddress,
    cards,
    runAccessGate,
    ensureAccountWalletReady,
    chainId,
  ]);

  const jobToBatchResult = useCallback(
    (job: PartnerVaultMintJobView, cardByCert: Map<string, SellFlowCard>) => {
      const succeeded: PartnerMintSucceeded[] = [];
      const skipped: PartnerMintBatchResult["skipped"] = [];
      for (const row of job.items) {
        const card = cardByCert.get(row.certNumber);
        const name =
          row.displayName?.trim() ||
          card?.name ||
          `PSA #${row.certNumber}`;
        if (row.status === "succeeded" && row.tokenId) {
          succeeded.push({
            cert: row.certNumber,
            name,
            tokenId: Number(row.tokenId),
            grade: card?.grade,
            cardNumber: card?.cardNumber,
            year: card?.year,
            setName: card?.setName,
            language: card?.language,
            variant: card?.variant,
          });
        } else if (row.status === "failed") {
          const detail = row.errorMessage ?? "Mint failed";
          const { kind, title } = classifyPartnerMintSkip(detail);
          skipped.push({
            cert: row.certNumber,
            name,
            kind,
            title,
            detail,
          });
        }
      }
      return { succeeded, skipped };
    },
    [],
  );

  const applyVaultMintJobFinished = useCallback(
    async (job: PartnerVaultMintJobView) => {
      if (vaultMintJobAppliedRef.current === job.id) return;
      vaultMintJobAppliedRef.current = job.id;
      const cardByCert = new Map(cardsRef.current.map((c) => [c.cert, c]));
      const result = jobToBatchResult(job, cardByCert);
      setCards((prev) => {
        const next = prev.filter(
          (c) => !result.succeeded.some((s) => s.cert === c.cert),
        );
        writeSellFlowDraftCards(next);
        return next;
      });
      if (result.succeeded.length > 0) {
        clearSellSubmissionPublicId();
      }
      writeSellFlowProgress({ step: "cards", vaultChoice: "self" });
      setPartnerMintSuccess(result);
      setMintStatus(null);
      setMintBusy(false);
      mintLockRef.current = false;
      setVaultMintJob(null);
      clearPartnerVaultMintJobId();
      const recipient = await ensureAccountWalletReady().catch(() => null);
      if (recipient) {
        for (const row of result.succeeded) {
          await invalidateAfterRwaMintTx(queryClient, {
            tokenId: row.tokenId,
            address: recipient,
          });
        }
      }
    },
    [jobToBatchResult, queryClient, ensureAccountWalletReady],
  );

  useEffect(() => {
    const stored = readPartnerVaultMintJobId();
    if (!stored) return;
    void getPartnerVaultMintJob(stored)
      .then((job) => {
        setVaultMintJob(job);
        if (job.status === "pending" || job.status === "processing") {
          setMintBusy(true);
        }
      })
      .catch(() => clearPartnerVaultMintJobId());
  }, []);

  useEffect(() => {
    if (!vaultMintJob) return;
    const terminal =
      vaultMintJob.status === "completed" || vaultMintJob.status === "failed";
    if (terminal) {
      void applyVaultMintJobFinished(vaultMintJob);
      return;
    }
    const id = vaultMintJob.id;
    const tick = () => {
      void getPartnerVaultMintJob(id)
        .then((job) => {
          setVaultMintJob(job);
          setMintStatus(
            job.itemCount > 0
              ? `Minting ${job.processedCount}/${job.itemCount}…`
              : null,
          );
          if (job.status === "completed" || job.status === "failed") {
            void applyVaultMintJobFinished(job);
          }
        })
        .catch(() => {
          setMintError("Lost connection to mint job — refresh to check portfolio");
          setMintBusy(false);
          clearPartnerVaultMintJobId();
          setVaultMintJob(null);
        });
    };
    tick();
    const interval = window.setInterval(tick, 2000);
    return () => window.clearInterval(interval);
  }, [vaultMintJob?.id, vaultMintJob?.status, applyVaultMintJobFinished]);

  const dismissPartnerMintResult = useCallback(() => {
    setPartnerMintSuccess(null);
    clearPartnerVaultMintJobId();
    setVaultMintJob(null);
  }, []);

  const resetPartnerAddCards = useCallback(() => {
    setPartnerMintSuccess(null);
    setCertInput("");
    setCertError(null);
    setMintError(null);
    setMintStatus(null);
    window.scrollTo(0, 0);
  }, []);

  return {
    screen,
    hydrated,
    draftRestored,
    idState,
    kycLoading,
    consents,
    allConsentsOn,
    requiredConsentsOk,
    canContinueRegister,
    canContinueVault,
    selfVaultEligible,
    selfVaultPartnerOnly,
    selfVaultNeedsCompanyAddress,
    vaultChoice,
    cards,
    maxCards: MAX_CARDS,
    showCertDirectInput: canUseSellCertDirectInput(user),
    certInput,
    setCertInput,
    certError,
    lookupBusy,
    draftSavedFlash,
    mintBusy,
    mintStatus,
    mintError,
    partnerMintSuccess,
    dismissPartnerMintResult,
    slabInputRef,
    canContinueShipping,
    updateConsent,
    startVerification,
    goToVault,
    goBackToVaultChoice,
    goToCards,
    goToRegister,
    selectVault,
    continueFromVault,
    lookupCert,
    lookupCertByNumber,
    scanSlab,
    onSlabFile,
    uploadSlabPhotos,
    toggleConfirm,
    setAllConfirmed,
    removeCard,
    saveDraft,
    continueToShipping,
    continueToSelfMint,
    resetPartnerAddCards,
  };
}
