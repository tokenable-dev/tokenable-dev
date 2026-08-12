"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  analyzePsaByCertNumber,
  analyzePsaSlab,
  getPartnerMe,
  listVaultSubmissions,
  rq,
  type PsaAnalyzeResult,
} from "@/lib/core";
import { invalidateAfterRwaMintTx } from "@/lib/core/invalidation";
import { fetchAuthMe } from "@/lib/auth";
import { fetchKycStatus } from "@/lib/kyc/api";
import type { KycStatus } from "@/lib/auth";
import { isKycComplete } from "@/lib/auth/accountAccess";
import { isPsaRateLimitError } from "@/lib/psa/psaApiErrors";
import { useAccessGate } from "@/hooks/auth/useAccessGate";
import { useEnsureAccountWalletReady } from "@/hooks/auth/useEnsureAccountWalletReady";
import {
  draftCardsFromSubmissionItems,
  readSellFlowDraftCards,
  readSellFlowProgress,
  clearSellSubmissionPublicId,
  writeSellFlowDraftCards,
  writeSellFlowProgress,
  writeSellSubmissionPublicId,
  type SellDraftCard,
  type SellVaultChoice,
} from "@/lib/sell/sellFlowDraft";
import { mintSellFlowCardByCert } from "@/lib/sell/mintSellFlowCard";
import {
  findSelfVaultBlockedCert,
  selfVaultBlockedMessage,
} from "@/lib/sell/psaShipmentSelfVaultGuard";
import { useAppChain } from "@/providers/AppChainProvider";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

export type SellFlowScreen = "register" | "vault" | "cards";

const KYC_RETURN_KEY = "tk_kyc_return_to";
/** Legacy key — consents are session-only now; cleared on hydrate. */
const CONSENTS_KEY = "tk_seller_consents";
const MAX_CARDS = 99;

export type SellFlowCard = SellDraftCard;

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

function buildCardTitle(r: PsaAnalyzeResult): string {
  const year = r.psa.year?.trim();
  const name = r.psa.cardNameHint?.trim();
  const set = r.psa.setHint?.trim();
  const num = r.psa.cardNumberHint?.trim();
  const parts = [year, set, num ? `#${num}` : null, name].filter(Boolean);
  if (parts.length) return parts.join(" ").toUpperCase();
  const cert = r.psa.certNumber?.trim();
  return cert ? `PSA CERT #${cert}` : "PSA GRADED CARD";
}

function cardFromAnalyze(
  r: PsaAnalyzeResult,
  certFallback: string,
  uploadPreviewDataUrl?: string | null,
): SellFlowCard | { error: string } {
  const cert = (r.psa.certNumber ?? certFallback).trim();
  const grade = r.psa.gradeScore;
  if (grade !== 9 && grade !== 10) {
    return { error: "Only PSA 9 and PSA 10 are accepted right now." };
  }
  const img =
    r.psaCertImages?.front?.trim() ||
    r.cardhedgerMint?.imageUrl?.trim() ||
    uploadPreviewDataUrl?.trim() ||
    null;
  return {
    cert,
    name: buildCardTitle(r),
    grade,
    img,
    confirmed: true,
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
  const [certInput, setCertInput] = useState("");
  const [certError, setCertError] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [draftSavedFlash, setDraftSavedFlash] = useState(false);
  const [mintBusy, setMintBusy] = useState(false);
  const [mintStatus, setMintStatus] = useState<string | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);
  const [partnerMintSuccess, setPartnerMintSuccess] = useState<number | null>(null);
  const slabInputRef = useRef<HTMLInputElement>(null);
  const lookupLockRef = useRef(false);
  const mintLockRef = useRef(false);
  const localHydrateDoneRef = useRef(false);
  const hydrateDoneRef = useRef(false);

  const idState = mapKycToIdState(user, kycStatus ?? user?.kycStatus);

  // Local restore — draft cards only. Always open register (seller terms each
  // visit). Optional `?vault=self|psa` prefills vault after Continue.
  useEffect(() => {
    if (localHydrateDoneRef.current) return;
    localHydrateDoneRef.current = true;
    const localCards = readSellFlowDraftCards();
    const q = searchParams.get("vault");
    const prefillsVault: SellVaultChoice | null =
      q === "self" || q === "psa" ? q : null;
    setCards(localCards);
    setVaultChoice(prefillsVault);
    setScreen("register");
    writeSellFlowProgress({
      step: "register",
      vaultChoice: prefillsVault,
    });
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
  }, [searchParams]);

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
    try {
      sessionStorage.setItem(KYC_RETURN_KEY, "/sell/flow");
    } catch {
      /* ignore */
    }
    useAuthUiStore.setState({ kycOpen: false, pendingReturnTo: "/sell/flow" });
    router.push("/kyc");
  }, [router]);

  /** After consents: resume cards if vault already chosen, else Choose vault. */
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
    writeSellFlowProgress({ step: "register" });
    setScreen("register");
    window.scrollTo(0, 0);
  }, []);

  const goBackToVaultChoice = useCallback(() => {
    if (!canContinueRegister) return;
    setVaultChoice(null);
    writeSellFlowProgress({ step: "vault", vaultChoice: null });
    setScreen("vault");
    window.scrollTo(0, 0);
  }, [canContinueRegister]);

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
    ) => {
      const built = cardFromAnalyze(r, certFallback, uploadPreviewDataUrl);
      if ("error" in built) {
        setCertError(built.error);
        return false;
      }
      if (cards.length >= MAX_CARDS) {
        setCertError("You can add up to 99 cards per submission.");
        return false;
      }
      if (cards.some((c) => c.cert === built.cert)) {
        setCertError("That card is already in your list.");
        return false;
      }
      setCards((prev) => {
        const next = [...prev, built];
        writeSellFlowDraftCards(next);
        writeSellFlowProgress({ step: "cards" });
        return next;
      });
      setCertInput("");
      setCertError(null);
      return true;
    },
    [cards],
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
      if (vaultChoice === "self") {
        const rows = await listVaultSubmissions();
        const blocked = findSelfVaultBlockedCert(rows, cert);
        if (blocked) {
          setCertError(selfVaultBlockedMessage(blocked));
          return;
        }
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
  }, [addCardFromResult, cards, certInput, vaultChoice]);

  const scanSlab = useCallback(() => {
    slabInputRef.current?.click();
  }, []);

  const onSlabFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setCertError(null);
      if (cards.length >= MAX_CARDS) {
        setCertError("You can add up to 99 cards per submission.");
        return;
      }
      lookupLockRef.current = true;
      setLookupBusy(true);
      try {
        const uploadPreview = await fileToThumbDataUrl(file);
        const r = await analyzePsaSlab(file);
        const cert = r.psa.certNumber?.trim() ?? "";
        if (!cert) {
          setCertError(
            "Couldn’t read a cert number from that image. Try Look up with the number on the slab.",
          );
          return;
        }
        if (vaultChoice === "self") {
          const rows = await listVaultSubmissions();
          const blocked = findSelfVaultBlockedCert(rows, cert);
          if (blocked) {
            setCertError(selfVaultBlockedMessage(blocked));
            return;
          }
        }
        addCardFromResult(r, cert, uploadPreview);
      } catch (e) {
        if (isPsaRateLimitError(e)) {
          setCertError(
            "PSA rate limit reached. Please wait and try again later.",
          );
        } else {
          setCertError(
            e instanceof Error ? e.message : "Slab scan failed. Try again.",
          );
        }
      } finally {
        lookupLockRef.current = false;
        setLookupBusy(false);
        if (slabInputRef.current) slabInputRef.current.value = "";
      }
    },
    [addCardFromResult, cards.length, vaultChoice],
  );

  const toggleConfirm = useCallback((index: number) => {
    setCards((prev) => {
      const next = prev.map((c, i) =>
        i === index ? { ...c, confirmed: !c.confirmed } : c,
      );
      writeSellFlowDraftCards(next);
      return next;
    });
  }, []);

  const setAllConfirmed = useCallback((confirmed: boolean) => {
    setCards((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.map((c) =>
        c.confirmed === confirmed ? c : { ...c, confirmed },
      );
      writeSellFlowDraftCards(next);
      return next;
    });
  }, []);

  const removeCard = useCallback((index: number) => {
    setCards((prev) => {
      const next = prev.filter((_, i) => i !== index);
      writeSellFlowDraftCards(next);
      writeSellFlowProgress({ step: "cards" });
      return next;
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

  const continueToShipping = useCallback(() => {
    if (!canContinueShipping) return;
    if (vaultChoice === "self") return;
    writeSellFlowDraftCards(cards);
    writeSellFlowProgress({ step: "shipping-pack", vaultChoice: "psa" });
    // First vault_submissions write happens on /sell/shipping (awaiting_shipment).
    router.push("/sell/shipping");
  }, [canContinueShipping, cards, router, vaultChoice]);

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
      const rows = await listVaultSubmissions();
      for (const card of confirmed) {
        const blocked = findSelfVaultBlockedCert(rows, card.cert);
        if (blocked) {
          throw new Error(selfVaultBlockedMessage(blocked));
        }
      }

      const recipientAddress = await ensureAccountWalletReady();
      const minted: { cert: string; tokenId: number }[] = [];
      for (let i = 0; i < confirmed.length; i++) {
        const card = confirmed[i]!;
        setMintStatus(
          `Minting ${i + 1}/${confirmed.length}: cert #${card.cert}…`,
        );
        const result = await mintSellFlowCardByCert({
          cert: card.cert,
          recipientAddress,
          chainId,
        });
        minted.push({ cert: result.cert, tokenId: result.tokenId });
        await invalidateAfterRwaMintTx(queryClient, {
          tokenId: result.tokenId,
          address: recipientAddress,
        });
      }
      writeSellFlowDraftCards([]);
      clearSellSubmissionPublicId();
      setCards([]);
      writeSellFlowProgress({ step: "cards", vaultChoice: "self" });
      setPartnerMintSuccess(minted.length);
    } catch (e) {
      setMintError(
        e instanceof Error ? e.message : "Partner vault mint failed",
      );
      setMintStatus(null);
    } finally {
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
    queryClient,
  ]);

  const resetPartnerAddCards = useCallback(() => {
    setPartnerMintSuccess(null);
    setCards([]);
    setCertInput("");
    setCertError(null);
    setMintError(null);
    setMintStatus(null);
    writeSellFlowDraftCards([]);
    writeSellFlowProgress({ step: "cards", vaultChoice: "self" });
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
    certInput,
    setCertInput,
    certError,
    lookupBusy,
    draftSavedFlash,
    mintBusy,
    mintStatus,
    mintError,
    partnerMintSuccess,
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
    scanSlab,
    onSlabFile,
    toggleConfirm,
    setAllConfirmed,
    removeCard,
    saveDraft,
    continueToShipping,
    continueToSelfMint,
    resetPartnerAddCards,
  };
}
