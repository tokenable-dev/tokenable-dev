"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  bannerCardLabel,
  bindSellFlowToUser,
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
  emptySellReturnAddress,
  formatSellReturnAddressSummary,
  isSellReturnAddressComplete,
  type SellCarrier,
  type SellDraftCard,
  type SellReturnAddressDraft,
  validateTracking,
} from "@/lib/sell/sellFlowDraft";
import {
  getVaultSubmission,
  listVaultSubmissions,
  markVaultPackingSlipDownloaded,
  registerVaultSubmissionTracking,
  upsertVaultSubmissionDraft,
  type VaultSubmissionApi,
} from "@/lib/core";
import { listShippingAddresses } from "@/lib/core/api/shipping-addresses";
import { useAuthStore } from "@/store/authStore";

export type ShipPanel = "pack" | "track";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function asSellCarrier(value: string | null | undefined): SellCarrier {
  return value === "dhl" || value === "ups" || value === "fedex" ? value : "fedex";
}

function asShipDate(value: string | null | undefined): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return todayIsoDate();
}

async function loadPreferredReturnAddress(
  fallback: SellReturnAddressDraft,
): Promise<SellReturnAddressDraft> {
  const blank =
    !fallback.name.trim() && !fallback.line1.trim() && !fallback.city.trim();
  if (!blank) return fallback;
  try {
    const rows = await listShippingAddresses();
    const preferred = rows.find((r) => r.isDefault) ?? rows[0] ?? null;
    if (!preferred) return fallback;
    return {
      name: preferred.name || "",
      line1: preferred.line1 || "",
      line2: preferred.line2 || "",
      city: preferred.city || "",
      region: preferred.region || "",
      postal: preferred.postal || "",
      country: preferred.country || "us",
      phone: preferred.phone || "",
    };
  } catch {
    return fallback;
  }
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
  const searchParams = useSearchParams();
  const submissionQuery = (searchParams.get("submission") ?? "").trim();
  const userId = useAuthStore((s) => s.user?.id);
  const authInitialized = useAuthStore((s) => s.initialized);
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
  const [returnAddress, setReturnAddress] = useState<SellReturnAddressDraft>(
    emptySellReturnAddress,
  );
  /** Collapsed saved summary vs editable fields (PSA-Shipping.html return-saved). */
  const [returnEditing, setReturnEditing] = useState(true);
  const [returnTouched, setReturnTouched] = useState(false);
  const [trackingTouched, setTrackingTouched] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [packageReady, setPackageReady] = useState(false);
  const [packageSyncing, setPackageSyncing] = useState(false);
  const [packageSyncError, setPackageSyncError] = useState<string | null>(null);
  /** Vault Detail → Change Tracking: update carrier/number on an in_transit package. */
  const [isTrackingEdit, setIsTrackingEdit] = useState(false);
  const [editReturnPath, setEditReturnPath] = useState<string | null>(null);
  const progressPersistReady = useRef(false);
  const packageCardsRef = useRef<SellDraftCard[]>([]);
  const isTrackingEditRef = useRef(false);

  const persistPackage = useCallback(async (packageCards: SellDraftCard[]) => {
    if (isTrackingEditRef.current) return true;
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
    if (!authInitialized) return;
    let cancelled = false;
    void (async () => {
      setBootMessage("Loading shipping…");
      bindSellFlowToUser(userId ?? null);
      let localCards = userId ? readSellFlowDraftCards() : [];
      let progress = readSellFlowProgress();
      isTrackingEditRef.current = false;
      setIsTrackingEdit(false);
      setEditReturnPath(null);

      try {
        if (!userId) {
          if (!cancelled) {
            setBootMessage("Sign in to continue shipping.");
            setReady(true);
          }
          return;
        }

        // Vault Detail: Register / Change Tracking for a specific package.
        if (submissionQuery) {
          setBootMessage("Loading package…");
          const sub = await getVaultSubmission(submissionQuery);
          if (cancelled) return;

          if (sub.status !== "awaiting_shipment" && sub.status !== "in_transit") {
            router.replace(
              `/vault/submissions/${encodeURIComponent(sub.publicId)}`,
            );
            return;
          }

          const packageCards = confirmedSellCards(
            draftCardsFromSubmissionItems(sub.items),
          );
          if (packageCards.length === 0) {
            router.replace("/sell/flow");
            return;
          }

          const vaultPath = `/vault/submissions/${encodeURIComponent(sub.publicId)}`;
          writeSellSubmissionPublicId(sub.publicId);
          packageCardsRef.current = packageCards;

          const nextReturn = await loadPreferredReturnAddress(progress.returnAddress);
          if (cancelled) return;

          if (sub.status === "in_transit") {
            // Change Tracking — do not upsert (reopens package) or overwrite sell draft.
            isTrackingEditRef.current = true;
            setIsTrackingEdit(true);
            setEditReturnPath(vaultPath);
            setCards(packageCards);
            setChecked(
              Array.from({ length: PSA_PACK_CHECKLIST.length }, () => true),
            );
            setSlipDownloaded(true);
            setCarrier(asSellCarrier(sub.carrier));
            setShipDate(asShipDate(sub.shipDate));
            setTrackingNumber(sub.trackingNumber ?? "");
            setReturnAddress(nextReturn);
            setReturnEditing(!isSellReturnAddressComplete(nextReturn));
            setPackageReady(true);
            setPackageSyncError(null);
            setPanel("track");
            writeSellFlowProgress({
              step: "shipping-track",
              carrier: asSellCarrier(sub.carrier),
              shipDate: asShipDate(sub.shipDate),
              trackingNumber: sub.trackingNumber ?? "",
              vaultChoice: "psa",
            });
            progressPersistReady.current = true;
            setReady(true);
            return;
          }

          // Register Tracking for awaiting_shipment — upsert then pack/track UI.
          writeSellFlowDraftCards(packageCards);
          localCards = packageCards;
          if (sub.packingSlipDownloadedAt) {
            writeSellFlowProgress({ slipDownloaded: true });
            progress = { ...progress, slipDownloaded: true };
          }

          setBootMessage("Saving your package…");
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
          setReturnAddress(nextReturn);
          setReturnEditing(!isSellReturnAddressComplete(nextReturn));
          setEditReturnPath(vaultPath);
          if (progress.step === "shipping-track") {
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
          return;
        }

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
      } catch (err) {
        if (submissionQuery) {
          if (!cancelled) {
            router.replace("/vault");
          }
          return;
        }
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
      const nextReturn = await loadPreferredReturnAddress(progress.returnAddress);
      if (!cancelled) {
        setReturnAddress(nextReturn);
        setReturnEditing(!isSellReturnAddressComplete(nextReturn));
      }
      if (progress.step === "shipping-track") {
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
  }, [router, authInitialized, userId, submissionQuery]);

  // Persist shipping form as the user fills it.
  useEffect(() => {
    if (!ready || !progressPersistReady.current) return;
    // Tracking edits must not overwrite an unrelated in-progress sell draft.
    if (isTrackingEditRef.current) {
      writeSellFlowProgress({
        carrier,
        shipDate,
        trackingNumber,
        returnAddress,
        vaultChoice: "psa",
      });
      return;
    }
    writeSellFlowProgress({
      step: panel === "track" ? "shipping-track" : "shipping-pack",
      checklist: checked,
      slipDownloaded,
      carrier,
      shipDate,
      trackingNumber,
      returnAddress,
      vaultChoice: "psa",
    });
  }, [ready, panel, checked, slipDownloaded, carrier, shipDate, trackingNumber, returnAddress]);

  const checkedCount = checked.filter(Boolean).length;
  const allChecked = checkedCount === PSA_PACK_CHECKLIST.length;
  /** PSA-Shipping.html: pack → track is always open; we still require package upsert. */
  const canContinuePack = packageReady && !packageSyncing;

  const trackingCheck = useMemo(
    () => validateTracking(carrier, trackingNumber),
    [carrier, trackingNumber],
  );
  const trackingErr =
    trackingTouched && trackingNumber.trim() && !trackingCheck.ok
      ? trackingCheck.hint
      : "";

  /** Tracking format + complete return address (manual entry; no Maps). */
  const returnComplete = isSellReturnAddressComplete(returnAddress);
  const canConfirm =
    trackingCheck.ok &&
    returnComplete &&
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
    if (confirmed || isTrackingEditRef.current) return;
    writeSellFlowProgress({ step: "shipping-pack" });
    setPanel("pack");
    window.scrollTo(0, 0);
  }, [confirmed]);

  const removeCard = useCallback(
    (index: number) => {
      if (confirmed || isTrackingEditRef.current) return;
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
      setReturnTouched(true);
      if (!isSellReturnAddressComplete(returnAddress)) {
        setReturnEditing(true);
      }
      return;
    }
    const cleaned = trackingNumber.replace(/\s+/g, "").toUpperCase();
    setConfirming(true);
    void (async () => {
      try {
        let publicId = readSellSubmissionPublicId();

        if (isTrackingEditRef.current) {
          if (!publicId) {
            throw new Error("Missing package id for tracking update");
          }
          const shipped = await registerVaultSubmissionTracking(publicId, {
            carrier,
            trackingNumber: cleaned,
            shipDate,
          });
          publicId = shipped.publicId;
          writeSellFlowProgress({
            carrier,
            shipDate,
            trackingNumber: cleaned,
            returnAddress,
            vaultChoice: "psa",
          });
          setConfirmed(true);
          const dest =
            editReturnPath ??
            `/vault/submissions/${encodeURIComponent(publicId)}`;
          window.setTimeout(() => {
            router.push(dest);
          }, 900);
          return;
        }

        // Refresh package then register tracking → in_transit.
        const draft = await upsertAwaitingShipmentPackage(cards);
        publicId = draft.publicId;
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
        // Preserve return address for the next PSA submission (manual entry; no Maps).
        writeSellFlowProgress({
          returnAddress,
          vaultChoice: "psa",
        });
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
  }, [
    canConfirm,
    carrier,
    cards,
    editReturnPath,
    returnAddress,
    router,
    shipDate,
    trackingNumber,
  ]);

  const beginChangeTracking = useCallback(() => {
    setConfirmed(false);
    setIsTrackingEdit(true);
    isTrackingEditRef.current = true;
    setPanel("track");
    setTrackingTouched(false);
  }, []);

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
    isTrackingEdit,
    carrier,
    setCarrier,
    shipDate,
    setShipDate,
    trackingNumber,
    setTrackingNumber: (v: string) => {
      setTrackingNumber(v);
      setTrackingTouched(true);
    },
    returnAddress,
    returnEditing,
    returnSummary: formatSellReturnAddressSummary(returnAddress),
    returnComplete,
    returnTouched,
    editReturnAddress: () => {
      if (confirmed) return;
      setReturnEditing(true);
      setReturnAddress(emptySellReturnAddress());
      setReturnTouched(false);
    },
    setReturnAddressField: <K extends keyof SellReturnAddressDraft>(
      key: K,
      value: SellReturnAddressDraft[K],
    ) => {
      setReturnEditing(true);
      setReturnTouched(true);
      setReturnAddress((prev) => ({ ...prev, [key]: value }));
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
    beginChangeTracking,
    backToCards: () => {
      if (confirmed) return;
      if (isTrackingEditRef.current && editReturnPath) {
        router.push(editReturnPath);
        return;
      }
      writeSellFlowProgress({ step: "cards" });
      router.push("/sell/flow");
    },
  };
}
