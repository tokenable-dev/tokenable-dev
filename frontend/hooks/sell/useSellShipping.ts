"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  bannerCardLabel,
  CARRIER_LABELS,
  CARRIER_TRACK_URLS,
  clearSellFlowDraftLocal,
  confirmedSellCards,
  draftCardsFromSubmissionItems,
  downloadPackingSlip,
  PSA_PACK_CHECKLIST,
  PSA_SHIP_TO_PLAIN,
  readSellFlowDraftCards,
  readSellFlowProgress,
  readSellSubmissionPublicId,
  clearSellSubmissionPublicId,
  writeSellFlowDraftCards,
  writeSellFlowProgress,
  writeSellSubmissionPublicId,
  type SellCarrier,
  type SellDraftCard,
  validateTracking,
} from "@/lib/sell/sellFlowDraft";
import {
  listVaultSubmissions,
  markVaultPackingSlipDownloaded,
  registerVaultSubmissionTracking,
  upsertVaultSubmissionDraft,
  type VaultSubmissionApi,
} from "@/lib/core";

export type ShipPanel = "pack" | "track";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function syncErrorMessage(err: unknown): string {
  let msg =
    err instanceof Error
      ? err.message
      : "Could not save your shipping package. Check your connection and try again.";
  try {
    const parsed = JSON.parse(msg) as { message?: string };
    if (parsed?.message) msg = parsed.message;
  } catch {
    /* plain text */
  }
  return msg;
}

/**
 * First durable vault_submissions write for the sell flow.
 * Always sends confirmed cards so the package lands as awaiting_shipment.
 */
async function upsertAwaitingShipmentPackage(
  cards: SellDraftCard[],
): Promise<VaultSubmissionApi> {
  const confirmed = confirmedSellCards(cards);
  if (confirmed.length === 0) {
    throw new Error("No confirmed cards to ship");
  }
  const saved = await upsertVaultSubmissionDraft({
    publicId: readSellSubmissionPublicId() ?? undefined,
    cards: confirmed.map((c) => ({
      cert: c.cert,
      name: c.name,
      grade: c.grade,
      img: c.img,
      confirmed: true,
    })),
  });
  writeSellSubmissionPublicId(saved.publicId);
  if (saved.status !== "awaiting_shipment") {
    throw new Error(
      `Package did not reach awaiting_shipment (got ${saved.status}). Tap retry.`,
    );
  }
  return saved;
}

export function useSellShipping() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [bootMessage, setBootMessage] = useState("Loading shipping…");
  const [cards, setCards] = useState<SellDraftCard[]>([]);
  const [panel, setPanel] = useState<ShipPanel>("pack");
  const [checked, setChecked] = useState<boolean[]>(() =>
    Array.from({ length: PSA_PACK_CHECKLIST.length }, () => false),
  );
  const [slipDownloaded, setSlipDownloaded] = useState(false);
  const [addrCopied, setAddrCopied] = useState(false);
  const [carrier, setCarrier] = useState<SellCarrier>("fedex");
  const [shipDate, setShipDate] = useState(todayIsoDate);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingTouched, setTrackingTouched] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [packageReady, setPackageReady] = useState(false);
  const [packageSyncing, setPackageSyncing] = useState(false);
  const [packageSyncError, setPackageSyncError] = useState<string | null>(null);
  const progressPersistReady = useRef(false);
  const packageCardsRef = useRef<SellDraftCard[]>([]);

  const persistPackage = useCallback(async (packageCards: SellDraftCard[]) => {
    packageCardsRef.current = packageCards;
    setPackageSyncing(true);
    setPackageSyncError(null);
    try {
      await upsertAwaitingShipmentPackage(packageCards);
      setPackageReady(true);
      return true;
    } catch (err) {
      setPackageReady(false);
      setPackageSyncError(syncErrorMessage(err));
      return false;
    } finally {
      setPackageSyncing(false);
    }
  }, []);

  const retryPackageSync = useCallback(() => {
    void persistPackage(packageCardsRef.current);
  }, [persistPackage]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBootMessage("Loading shipping…");
      let localCards = readSellFlowDraftCards();
      let progress = readSellFlowProgress();

      try {
        const rows = await listVaultSubmissions();
        if (cancelled) return;

        // Pre-ship server package is awaiting_shipment only (draft rows are ignored).
        const openShip = rows.find((s) => s.status === "awaiting_shipment");
        if (openShip) {
          writeSellSubmissionPublicId(openShip.publicId);
          const serverCards = draftCardsFromSubmissionItems(openShip.items);
          const serverConfirmed = confirmedSellCards(serverCards);
          if (
            serverConfirmed.length > 0 &&
            confirmedSellCards(localCards).length === 0
          ) {
            // Resume mid-ship on a new browser with empty local cards.
            writeSellFlowDraftCards(serverCards);
            localCards = serverCards;
          }
          if (openShip.packingSlipDownloadedAt) {
            writeSellFlowProgress({ slipDownloaded: true });
            progress = { ...progress, slipDownloaded: true };
          }
        } else {
          // Stale SUB-… from a cancelled package or legacy draft — start clean.
          clearSellSubmissionPublicId();
        }
      } catch {
        /* local cards still paint; upsert below may fail → retry UI */
      }

      if (cancelled) return;

      const packageCards = confirmedSellCards(localCards);
      if (packageCards.length === 0) {
        router.replace("/sell/flow");
        return;
      }

      // First durable write for this sell flow (or refresh of open ship package).
      setBootMessage("Saving your package…");
      packageCardsRef.current = packageCards;
      setPackageSyncing(true);
      setPackageSyncError(null);
      try {
        await upsertAwaitingShipmentPackage(packageCards);
        if (!cancelled) setPackageReady(true);
      } catch (err) {
        if (!cancelled) {
          setPackageReady(false);
          setPackageSyncError(syncErrorMessage(err));
        }
      } finally {
        if (!cancelled) setPackageSyncing(false);
      }

      if (cancelled) return;

      setCards(packageCards);
      setChecked(
        progress.checklist.length === PSA_PACK_CHECKLIST.length
          ? progress.checklist
          : Array.from({ length: PSA_PACK_CHECKLIST.length }, () => false),
      );
      setSlipDownloaded(progress.slipDownloaded);
      setCarrier(progress.carrier);
      setShipDate(progress.shipDate || todayIsoDate());
      setTrackingNumber(progress.trackingNumber);
      if (
        progress.step === "shipping-track" &&
        progress.slipDownloaded &&
        progress.checklist.every(Boolean)
      ) {
        setPanel("track");
      } else {
        setPanel("pack");
        writeSellFlowProgress({
          step: "shipping-pack",
          vaultChoice: "psa",
        });
      }
      progressPersistReady.current = true;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Persist shipping form as the user fills it.
  useEffect(() => {
    if (!ready || !progressPersistReady.current) return;
    writeSellFlowProgress({
      step: panel === "track" ? "shipping-track" : "shipping-pack",
      checklist: checked,
      slipDownloaded,
      carrier,
      shipDate,
      trackingNumber,
      vaultChoice: "psa",
    });
  }, [ready, panel, checked, slipDownloaded, carrier, shipDate, trackingNumber]);

  const checkedCount = checked.filter(Boolean).length;
  const allChecked = checkedCount === PSA_PACK_CHECKLIST.length;
  const canContinuePack =
    allChecked && slipDownloaded && packageReady && !packageSyncing;

  const trackingCheck = useMemo(
    () => validateTracking(carrier, trackingNumber),
    [carrier, trackingNumber],
  );
  const trackingErr =
    trackingTouched && trackingNumber.trim() && !trackingCheck.ok
      ? trackingCheck.hint
      : "";

  const canConfirm =
    allChecked &&
    slipDownloaded &&
    trackingCheck.ok &&
    packageReady &&
    !packageSyncing &&
    !confirmed &&
    !confirming;

  const bannerLabel = useMemo(() => bannerCardLabel(cards), [cards]);

  const shipSublabel = confirmed
    ? "In Transit"
    : panel === "track"
      ? "Tracking"
      : "Pending";

  const toggleCheck = useCallback((index: number) => {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  const copyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(PSA_SHIP_TO_PLAIN);
      setAddrCopied(true);
      window.setTimeout(() => setAddrCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  const onDownloadSlip = useCallback(() => {
    void (async () => {
      await downloadPackingSlip(cards);
      setSlipDownloaded(true);
      writeSellFlowProgress({ slipDownloaded: true });
      const publicId = readSellSubmissionPublicId();
      if (!publicId || !packageReady) return;
      try {
        await markVaultPackingSlipDownloaded(publicId);
      } catch {
        // Stale publicId — clear and re-upsert so confirm can recreate.
        clearSellSubmissionPublicId();
        setPackageReady(false);
        await persistPackage(packageCardsRef.current);
      }
    })();
  }, [cards, packageReady, persistPackage]);

  const goToTrack = useCallback(() => {
    if (!canContinuePack) return;
    writeSellFlowProgress({ step: "shipping-track" });
    setPanel("track");
    window.scrollTo(0, 0);
  }, [canContinuePack]);

  const goToPack = useCallback(() => {
    if (confirmed) return;
    writeSellFlowProgress({ step: "shipping-pack" });
    setPanel("pack");
    window.scrollTo(0, 0);
  }, [confirmed]);

  const removeCard = useCallback(
    (index: number) => {
      if (confirmed) return;
      const removed = cards[index];
      if (!removed) return;

      const nextPackage = cards.filter((_, i) => i !== index);
      setCards(nextPackage);
      packageCardsRef.current = nextPackage;

      // Keep unconfirmed local cards for Add-cards; drop this cert from full draft.
      const fullLocal = readSellFlowDraftCards().filter(
        (c) => c.cert !== removed.cert,
      );
      writeSellFlowDraftCards(fullLocal);

      if (confirmedSellCards(nextPackage).length === 0) {
        writeSellFlowProgress({ step: "cards" });
        router.push("/sell/flow");
        return;
      }

      setSlipDownloaded(false);
      writeSellFlowProgress({ slipDownloaded: false, step: "shipping-pack" });
      setPanel("pack");
      void persistPackage(nextPackage);
    },
    [cards, confirmed, persistPackage, router],
  );

  const confirmShipment = useCallback(() => {
    if (!canConfirm) {
      setTrackingTouched(true);
      return;
    }
    const cleaned = trackingNumber.replace(/\s+/g, "").toUpperCase();
    setConfirming(true);
    void (async () => {
      try {
        // Refresh package then register tracking → in_transit.
        const draft = await upsertAwaitingShipmentPackage(cards);
        let publicId = draft.publicId;
        writeSellSubmissionPublicId(publicId);
        setPackageReady(true);
        setPackageSyncError(null);

        const shipped = await registerVaultSubmissionTracking(publicId, {
          carrier,
          trackingNumber: cleaned,
          shipDate,
        });
        publicId = shipped.publicId;
        writeSellSubmissionPublicId(publicId);
        clearSellFlowDraftLocal();
        setConfirmed(true);
        window.setTimeout(() => {
          router.push(`/vault/submissions/${encodeURIComponent(publicId)}`);
        }, 1200);
      } catch (err) {
        setPackageSyncError(syncErrorMessage(err));
        window.alert(syncErrorMessage(err));
      } finally {
        setConfirming(false);
      }
    })();
  }, [canConfirm, carrier, cards, router, shipDate, trackingNumber]);

  const trackUrl = confirmed
    ? `${CARRIER_TRACK_URLS[carrier]}${encodeURIComponent(
        trackingNumber.replace(/\s+/g, "").toUpperCase(),
      )}`
    : null;

  const trackingSummary = confirmed
    ? `${CARRIER_LABELS[carrier]} · ${trackingNumber.replace(/\s+/g, "").toUpperCase()}`
    : "";

  return {
    ready,
    bootMessage,
    cards,
    panel,
    checklistItems: PSA_PACK_CHECKLIST,
    checked,
    checkedCount,
    allChecked,
    slipDownloaded,
    addrCopied,
    canContinuePack,
    packageReady,
    packageSyncing,
    packageSyncError,
    retryPackageSync,
    carrier,
    setCarrier,
    shipDate,
    setShipDate,
    trackingNumber,
    setTrackingNumber: (v: string) => {
      setTrackingNumber(v);
      setTrackingTouched(true);
    },
    trackingErr,
    canConfirm,
    confirmed,
    confirming,
    bannerLabel,
    shipSublabel,
    trackUrl,
    trackingSummary,
    toggleCheck,
    copyAddress,
    onDownloadSlip,
    goToTrack,
    goToPack,
    removeCard,
    confirmShipment,
    backToCards: () => {
      if (confirmed) return;
      writeSellFlowProgress({ step: "cards" });
      router.push("/sell/flow");
    },
  };
}
