"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  analyzePsaByCertNumber,
  analyzePsaSlab,
  listVaultSubmissions,
  upsertVaultSubmissionDraft,
  type PsaAnalyzeResult,
} from "@/lib/core";
import { fetchAuthMe } from "@/lib/auth";
import { fetchKycStatus } from "@/lib/kyc/api";
import type { KycStatus } from "@/lib/auth";
import { isKycComplete } from "@/lib/auth/accountAccess";
import { isPsaRateLimitError } from "@/lib/psa/psaApiErrors";
import {
  draftCardsFromSubmissionItems,
  readSellFlowDraftCards,
  readSellFlowProgress,
  readSellSubmissionPublicId,
  writeSellFlowDraftCards,
  writeSellFlowProgress,
  writeSellSubmissionPublicId,
  type SellDraftCard,
} from "@/lib/sell/sellFlowDraft";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

export type SellFlowScreen = "register" | "cards";

const KYC_RETURN_KEY = "tk_kyc_return_to";
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

function readConsents(): SellConsents {
  try {
    const raw = localStorage.getItem(CONSENTS_KEY);
    if (!raw) return { ...EMPTY_CONSENTS };
    const parsed = JSON.parse(raw) as Partial<SellConsents>;
    return { ...EMPTY_CONSENTS, ...parsed };
  } catch {
    return { ...EMPTY_CONSENTS };
  }
}

function writeConsents(next: SellConsents) {
  try {
    localStorage.setItem(CONSENTS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

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
    confirmed: false,
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

  const [screen, setScreen] = useState<SellFlowScreen>("register");
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
  const slabInputRef = useRef<HTMLInputElement>(null);
  const lookupLockRef = useRef(false);
  const skipNextServerSyncRef = useRef(true);
  const hydrateDoneRef = useRef(false);

  const idState = mapKycToIdState(user, kycStatus ?? user?.kycStatus);

  // Local restore (instant) — cards, consents, last step.
  useEffect(() => {
    const localCards = readSellFlowDraftCards();
    const progress = readSellFlowProgress();
    setConsents(readConsents());
    setCards(localCards);
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
        if (!open) return;

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
  const canContinueShipping = cards.some((c) => c.confirmed);

  // Resume Add Cards once on hydrate when register gates + draft/progress say so.
  // Do not re-force cards after the user navigates back to register.
  const resumeScreenRef = useRef(false);
  useEffect(() => {
    if (!hydrated || !canContinueRegister || resumeScreenRef.current) return;
    resumeScreenRef.current = true;
    const progress = readSellFlowProgress();
    const hasCards = cards.length > 0 || readSellFlowDraftCards().length > 0;
    if (
      progress.step === "cards" ||
      progress.step === "shipping-pack" ||
      progress.step === "shipping-track" ||
      hasCards
    ) {
      setScreen("cards");
    }
  }, [hydrated, canContinueRegister, cards.length]);

  // Debounced account sync whenever the card draft changes.
  useEffect(() => {
    if (!hydrated || !user?.id) return;
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
  }, [cards, hydrated, user?.id]);

  const updateConsent = useCallback((key: keyof SellConsents | "all") => {
    setConsents((prev) => {
      let next: SellConsents;
      if (key === "all") {
        const allOn =
          prev.terms &&
          prev.authenticity &&
          prev.storage &&
          prev.fee &&
          prev.marketing;
        const turnOn = !allOn;
        next = {
          terms: turnOn,
          authenticity: turnOn,
          storage: turnOn,
          fee: turnOn,
          marketing: turnOn,
        };
      } else {
        next = { ...prev, [key]: !prev[key] };
      }
      writeConsents(next);
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

  const goToCards = useCallback(() => {
    if (!canContinueRegister) return;
    writeSellFlowProgress({ step: "cards" });
    setScreen("cards");
    window.scrollTo(0, 0);
  }, [canContinueRegister]);

  const goToRegister = useCallback(() => {
    writeSellFlowProgress({ step: "register" });
    setScreen("register");
    window.scrollTo(0, 0);
  }, []);

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
    writeSellFlowDraftCards(cards);
    writeSellFlowProgress({ step: "shipping-pack" });
    try {
      await pushDraftToServer(cards);
    } catch {
      /* still allow shipping UI with local draft */
    }
    router.push("/sell/shipping");
  }, [canContinueShipping, cards, router]);

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
    cards,
    maxCards: MAX_CARDS,
    certInput,
    setCertInput,
    certError,
    lookupBusy,
    draftSavedFlash,
    slabInputRef,
    canContinueShipping,
    updateConsent,
    startVerification,
    goToCards,
    goToRegister,
    lookupCert,
    scanSlab,
    onSlabFile,
    toggleConfirm,
    removeCard,
    saveDraft,
    continueToShipping,
  };
}
