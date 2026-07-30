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
} from "@/lib/core";

export type ShipPanel = "pack" | "track";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function useSellShipping() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
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
  const progressPersistReady = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let draft = readSellFlowDraftCards();
      let progress = readSellFlowProgress();

      try {
        const rows = await listVaultSubmissions();
        if (cancelled) return;
        const open = rows.find(
          (s) => s.status === "draft" || s.status === "awaiting_shipment",
        );
        if (open) {
          writeSellSubmissionPublicId(open.publicId);
          const serverCards = draftCardsFromSubmissionItems(open.items);
          if (serverCards.length > 0 && confirmedSellCards(serverCards).length > 0) {
            if (draft.length === 0 || confirmedSellCards(draft).length === 0) {
              writeSellFlowDraftCards(serverCards);
              draft = serverCards;
            }
          }
          if (open.packingSlipDownloadedAt) {
            writeSellFlowProgress({ slipDownloaded: true });
            progress = { ...progress, slipDownloaded: true };
          }
        } else {
          // Server has no open draft — drop stale SUB-… from localStorage (common after DB wipe).
          clearSellSubmissionPublicId();
        }
      } catch {
        /* local draft is enough for paint; we still try upsert below */
      }

      if (cancelled) return;

      const confirmedCards = confirmedSellCards(draft);
      if (confirmedCards.length === 0) {
        router.replace("/sell/flow");
        return;
      }

      // Persist as awaiting_shipment so leaving before tracking still leaves an admin-visible draft.
      try {
        const saved = await upsertVaultSubmissionDraft({
          publicId: readSellSubmissionPublicId() ?? undefined,
          cards: confirmedCards.map((c) => ({
            cert: c.cert,
            name: c.name,
            grade: c.grade,
            img: c.img,
            confirmed: true,
          })),
        });
        if (!cancelled) writeSellSubmissionPublicId(saved.publicId);
      } catch {
        /* local progress still works; hub/admin need server draft */
      }

      if (cancelled) return;

      setCards(draft);
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
        writeSellFlowProgress({ step: "shipping-pack" });
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
    });
  }, [ready, panel, checked, slipDownloaded, carrier, shipDate, trackingNumber]);

  const checkedCount = checked.filter(Boolean).length;
  const allChecked = checkedCount === PSA_PACK_CHECKLIST.length;
  const canContinuePack = allChecked && slipDownloaded;

  const trackingCheck = useMemo(
    () => validateTracking(carrier, trackingNumber),
    [carrier, trackingNumber],
  );
  const trackingErr =
    trackingTouched && trackingNumber.trim() && !trackingCheck.ok
      ? trackingCheck.hint
      : "";

  const canConfirm =
    allChecked && slipDownloaded && trackingCheck.ok && !confirmed && !confirming;

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
      if (!publicId) return;
      try {
        await markVaultPackingSlipDownloaded(publicId);
      } catch {
        // Stale publicId (DB wipe) — clear so confirm upsert creates a fresh row.
        clearSellSubmissionPublicId();
      }
    })();
  }, [cards]);

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
      const next = cards.filter((_, i) => i !== index);
      writeSellFlowDraftCards(next);
      setCards(next);
      if (confirmedSellCards(next).length === 0) {
        writeSellFlowProgress({ step: "cards" });
        router.push("/sell/flow");
        return;
      }
      setSlipDownloaded(false);
      writeSellFlowProgress({ slipDownloaded: false, step: "shipping-pack" });
      setPanel("pack");
    },
    [cards, confirmed, router],
  );

  const confirmShipment = useCallback(() => {
    if (!canConfirm) {
      setTrackingTouched(true);
      return;
    }
    const cleaned = trackingNumber.replace(/\s+/g, "").toUpperCase();
    const confirmedCards = confirmedSellCards(cards);
    setConfirming(true);
    void (async () => {
      try {
        // Always upsert first — localStorage publicId may be stale (DB reset, old env,
        // or draft never persisted). Tracking alone would 404 "Submission not found".
        const draft = await upsertVaultSubmissionDraft({
          publicId: readSellSubmissionPublicId() ?? undefined,
          cards: confirmedCards.map((c) => ({
            cert: c.cert,
            name: c.name,
            grade: c.grade,
            img: c.img,
            confirmed: true,
          })),
        });
        let publicId = draft.publicId;
        writeSellSubmissionPublicId(publicId);

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
        let msg =
          err instanceof Error
            ? err.message
            : "Failed to register shipment on the server. Please try again.";
        try {
          const parsed = JSON.parse(msg) as { message?: string };
          if (parsed?.message) msg = parsed.message;
        } catch {
          /* plain text */
        }
        window.alert(msg);
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
    cards,
    panel,
    checklistItems: PSA_PACK_CHECKLIST,
    checked,
    checkedCount,
    allChecked,
    slipDownloaded,
    addrCopied,
    canContinuePack,
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
