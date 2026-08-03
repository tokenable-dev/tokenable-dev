"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  analyzePsaByCertNumber,
  analyzePsaSlab,
  listVaultSubmissions,
  upsertVaultSubmissionDraft,
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
  readSellSubmissionPublicId,
  clearSellSubmissionPublicId,
  writeSellFlowDraftCards,
  writeSellFlowProgress,
  writeSellSubmissionPublicId,
  type SellDraftCard,
  type SellVaultChoice,
} from "@/lib/sell/sellFlowDraft";
import { mintSellFlowCardByCert } from "@/lib/sell/mintSellFlowCard";
import { useAppChain } from "@/providers/AppChainProvider";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

export type SellFlowScreen = "register" | "vault" | "cards";

const KYC_RETURN_KEY = "tk_kyc_return_to";
/** Legacy key — consents are session-only now; cleared on hydrate. */
const CONSENTS_KEY = "tk_seller_consents";
const MAX_CARDS = 99;
const SERVER_SYNC_MS = 900;

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

function cardFromAnalyze(r: PsaAnalyzeResult, certFallback: string): SellFlowCard | { error: string } {
  const cert = (r.psa.certNumber ?? certFallback).trim();
  const grade = r.psa.gradeScore;
  if (grade !== 9 && grade !== 10) {
    return { error: "Only PSA 9 and PSA 10 are accepted right now." };
  }
  const img =
    r.psaCertImages?.front?.trim() ||
    r.cardhedgerMint?.imageUrl?.trim() ||
    null;
  return {
    cert,
    name: buildCardTitle(r),
    grade,
    img,
    confirmed: true,
  };
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

async function pushDraftToServer(cards: SellFlowCard[]) {
  const publicId = readSellSubmissionPublicId() ?? undefined;
  const res = await upsertVaultSubmissionDraft({
    publicId,
    cards: cards.map((c) => ({
      cert: c.cert,
      name: c.name,
      grade: c.grade,
      img: c.img,
      confirmed: c.confirmed,
    })),
  });
  writeSellSubmissionPublicId(res.publicId);
  return res;
}

export function useSellFlow() {
  const router = useRouter();
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
  const slabInputRef = useRef<HTMLInputElement>(null);
  const lookupLockRef = useRef(false);
  const mintLockRef = useRef(false);
  const skipNextServerSyncRef = useRef(true);
  const hydrateDoneRef = useRef(false);

  const idState = mapKycToIdState(user, kycStatus ?? user?.kycStatus);

  // Local restore (instant) — cards + last step. Consents are never persisted:
  // seller policy must be re-accepted every visit / submission.
  useEffect(() => {
    const localCards = readSellFlowDraftCards();
    const progress = readSellFlowProgress();
    setCards(localCards);
    setVaultChoice(progress.vaultChoice);
    setConsents({ ...EMPTY_CONSENTS });
    try {
      localStorage.removeItem(CONSENTS_KEY);
    } catch {
      /* ignore */
    }
    if (
      localCards.length > 0 ||
      progress.step === "cards" ||
      progress.step === "shipping-pack" ||
      progress.step === "shipping-track"
    ) {
      setDraftRestored(localCards.length > 0);
    }
    setHydrated(true);
  }, []);

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

  // Account hydrate — pull open draft from server if local is empty / out of date.
  useEffect(() => {
    if (!user?.id || !hydrated || hydrateDoneRef.current) return;
    hydrateDoneRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listVaultSubmissions();
        if (cancelled) return;
        const open = rows.find(
          (s) => s.status === "draft" || s.status === "awaiting_shipment",
        );
        if (!open) {
          clearSellSubmissionPublicId();
          return;
        }

        writeSellSubmissionPublicId(open.publicId);
        const serverCards = draftCardsFromSubmissionItems(open.items);
        const localCards = readSellFlowDraftCards();
        const preferServer =
          localCards.length === 0 ||
          (serverCards.length > localCards.length &&
            new Date(open.updatedAt).getTime() >
              new Date(readSellFlowProgress().updatedAt).getTime());

        if (preferServer && serverCards.length > 0) {
          skipNextServerSyncRef.current = true;
          writeSellFlowDraftCards(serverCards);
          setCards(serverCards);
          setDraftRestored(true);
          writeSellFlowProgress({
            step:
              open.status === "awaiting_shipment"
                ? "shipping-pack"
                : serverCards.length > 0
                  ? "cards"
                  : "register",
            slipDownloaded: Boolean(open.packingSlipDownloadedAt),
          });
        } else if (open.packingSlipDownloadedAt) {
          writeSellFlowProgress({ slipDownloaded: true });
        }
      } catch {
        /* offline / not signed in edge — local draft still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, hydrated]);

  const requiredConsentsOk = useMemo(
    () =>
      consents.terms &&
      consents.authenticity &&
      consents.storage &&
      consents.fee,
    [consents],
  );

  const allConsentsOn = useMemo(
    () => requiredConsentsOk && consents.marketing,
    [requiredConsentsOk, consents.marketing],
  );

  const canContinueRegister = idState === "verified" && requiredConsentsOk;
  const canContinueVault = vaultChoice === "self" || vaultChoice === "psa";
  const canContinueShipping = cards.some((c) => c.confirmed);

  // Do not auto-advance when consents become valid — user must press Continue.
  // Draft cards / progress are still restored into state for the Add-cards screen.
  // Debounced account sync for PSA vault drafts only (self vault mints, no ship package).
  useEffect(() => {
    if (!hydrated || !user?.id) return;
    if (vaultChoice === "self") return;
    if (skipNextServerSyncRef.current) {
      skipNextServerSyncRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void pushDraftToServer(cards).catch(() => {
        /* keep local draft */
      });
    }, SERVER_SYNC_MS);
    return () => window.clearTimeout(timer);
  }, [cards, hydrated, user?.id, vaultChoice]);

  const updateConsent = useCallback((key: keyof SellConsents | "all") => {
    setConsents((prev) => {
      if (key === "all") {
        const allOn =
          prev.terms &&
          prev.authenticity &&
          prev.storage &&
          prev.fee &&
          prev.marketing;
        const turnOn = !allOn;
        return {
          terms: turnOn,
          authenticity: turnOn,
          storage: turnOn,
          fee: turnOn,
          marketing: turnOn,
        };
      }
      return { ...prev, [key]: !prev[key] };
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

  const goToVault = useCallback(() => {
    if (!canContinueRegister) return;
    writeSellFlowProgress({ step: "vault" });
    setScreen("vault");
    window.scrollTo(0, 0);
  }, [canContinueRegister]);

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

  const selectVault = useCallback((choice: SellVaultChoice) => {
    setVaultChoice(choice);
    writeSellFlowProgress({ step: "vault", vaultChoice: choice });
  }, []);

  const continueFromVault = useCallback(() => {
    if (!vaultChoice) return;
    writeSellFlowProgress({
      step: "cards",
      vaultChoice: vaultChoice === "self" ? "self" : "psa",
    });
    setScreen("cards");
    window.scrollTo(0, 0);
  }, [vaultChoice]);

  const addCardFromResult = useCallback(
    (r: PsaAnalyzeResult, certFallback: string) => {
      const built = cardFromAnalyze(r, certFallback);
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
  }, [addCardFromResult, cards, certInput]);

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
        const r = await analyzePsaSlab(file);
        const cert = r.psa.certNumber?.trim() ?? "";
        if (!cert) {
          setCertError(
            "Couldn’t read a cert number from that image. Try Look up with the number on the slab.",
          );
          return;
        }
        addCardFromResult(r, cert);
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
    [addCardFromResult, cards.length],
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

  const saveDraft = useCallback(async () => {
    writeSellFlowDraftCards(cards);
    writeSellFlowProgress({ step: "cards" });
    try {
      await pushDraftToServer(cards);
    } catch {
      /* keep local draft even if API fails */
    }
    setDraftSavedFlash(true);
    window.setTimeout(() => setDraftSavedFlash(false), 1400);
  }, [cards]);

  const continueToShipping = useCallback(async () => {
    if (!canContinueShipping) return;
    if (vaultChoice === "self") return;
    writeSellFlowDraftCards(cards);
    writeSellFlowProgress({ step: "shipping-pack", vaultChoice: "psa" });
    try {
      await pushDraftToServer(cards);
    } catch {
      /* still allow shipping UI with local draft */
    }
    router.push("/sell/shipping");
  }, [canContinueShipping, cards, router, vaultChoice]);

  /** Self vault: mint confirmed cards directly to the user's portfolio wallet. */
  const continueToSelfMint = useCallback(async () => {
    if (vaultChoice !== "self" || !canContinueShipping) return;
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
      writeSellFlowProgress({ step: "register", vaultChoice: null });
      setMintStatus(`Minted ${minted.length} card(s) to your portfolio.`);
      router.push("/portfolio");
    } catch (e) {
      setMintError(
        e instanceof Error ? e.message : "Self vault mint failed",
      );
      setMintStatus(null);
    } finally {
      mintLockRef.current = false;
      setMintBusy(false);
    }
  }, [
    vaultChoice,
    canContinueShipping,
    cards,
    runAccessGate,
    ensureAccountWalletReady,
    chainId,
    queryClient,
    router,
  ]);

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
    slabInputRef,
    canContinueShipping,
    updateConsent,
    startVerification,
    goToVault,
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
  };
}
