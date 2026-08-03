"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAccessGate } from "@/hooks/auth/useAccessGate";
import { useAppChain } from "@/providers/AppChainProvider";
import {
  EMPTY_REDEEM_ADDRESS_FORM,
  clearRedeemDraft,
  clearSavedRedeemAddress,
  readRedeemDraft,
  readSavedRedeemAddress,
  writeRedeemDraft,
  writeSavedRedeemAddress,
  type RedeemAddressForm,
  type RedeemDraft,
  type RedeemDraftCard,
} from "@/lib/portfolio/redeemDraft";
import {
  getMyRedemptions,
  postRedeemRequest,
  type RedeemShipTo,
} from "@/lib/core/api/rwa-redeem";

export type RedeemFlowStep =
  | "request"
  | "requested"
  | "pay"
  | "transit"
  | "done";

function validateShipTo(form: RedeemAddressForm): string | null {
  if (!form.name.trim()) return "Enter the recipient name.";
  if (!form.line1.trim()) return "Enter the street address.";
  if (!form.city.trim()) return "Enter the city.";
  if (!form.postal.trim()) return "Enter the postal code.";
  if (!form.phone.trim()) return "Enter a phone number.";
  return null;
}

function toShipTo(form: RedeemAddressForm): RedeemShipTo {
  return {
    name: form.name.trim(),
    line1: form.line1.trim(),
    line2: form.line2?.trim() || undefined,
    city: form.city.trim(),
    region: form.region?.trim() || undefined,
    postal: form.postal.trim(),
    country: form.country,
    phone: form.phone.trim(),
  };
}

export function useRedeemFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { chainId } = useAppChain();
  const { runAccessGate } = useAccessGate(2, "/portfolio/redeem");

  const viewParam = searchParams.get("view");

  const [draft, setDraft] = useState<RedeemDraft | null>(null);
  const [displayCards, setDisplayCards] = useState<RedeemDraftCard[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState<RedeemFlowStep>("request");
  const [form, setForm] = useState<RedeemAddressForm>(EMPTY_REDEEM_ADDRESS_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const saved = readSavedRedeemAddress();
      if (saved && !cancelled) setForm(saved);

      if (viewParam === "transit" || viewParam === "done") {
        try {
          const rows = await getMyRedemptions();
          if (cancelled) return;
          const draftCards = readRedeemDraft()?.cards ?? [];
          const byId = new Map(draftCards.map((c) => [c.tokenId, c]));
          const cards: RedeemDraftCard[] = rows
            .filter((r) =>
              viewParam === "transit"
                ? r.status === "burned" ||
                  r.status === "vault_release_pending" ||
                  r.status === "completed"
                : r.status === "completed",
            )
            .map((r) => {
              const tid = Number(r.tokenId);
              const fromDraft = byId.get(tid);
              return (
                fromDraft ?? {
                  tokenId: tid,
                  name: `RWA #${r.tokenId}`,
                  imageUrl: null,
                  grade: null,
                  certNumber: null,
                  vaultLabel: "PSA Vault",
                }
              );
            });
          setDisplayCards(cards);
          setStep(viewParam === "done" ? "done" : "transit");
          setSubmitted(true);
          setHydrated(true);
          return;
        } catch {
          if (cancelled) return;
          setSubmitted(true);
          setStep(viewParam === "done" ? "done" : "transit");
          setHydrated(true);
          return;
        }
      }

      const loaded = readRedeemDraft();
      if (!loaded || loaded.cards.length === 0) {
        setDraft(null);
        setHydrated(true);
        return;
      }
      if (loaded.chainId !== chainId) {
        clearRedeemDraft();
        setDraft(null);
        setHydrated(true);
        return;
      }
      setDraft(loaded);
      setDisplayCards(loaded.cards);
      setHydrated(true);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [chainId, viewParam]);

  useEffect(() => {
    if (!hydrated) return;
    if (submitted) return;
    if (!draft || draft.cards.length === 0) {
      router.replace("/portfolio");
    }
  }, [hydrated, draft, router, submitted]);

  const cards = displayCards;

  const removeCard = useCallback((tokenId: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextCards = prev.cards.filter((c) => c.tokenId !== tokenId);
      if (nextCards.length === 0) {
        clearRedeemDraft();
        setDisplayCards([]);
        return null;
      }
      const next: RedeemDraft = { ...prev, cards: nextCards };
      writeRedeemDraft(next);
      setDisplayCards(nextCards);
      return next;
    });
  }, []);

  const submitRequest = useCallback(async () => {
    if (!draft || draft.cards.length === 0) return;
    const validationError = validateShipTo(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!runAccessGate()) return;

    setBusy(true);
    setError(null);
    const shipTo = toShipTo(form);

    if (form.saveAddress) {
      writeSavedRedeemAddress(shipTo);
    } else {
      clearSavedRedeemAddress();
    }

    const failures: string[] = [];
    let okCount = 0;

    for (const card of draft.cards) {
      try {
        await postRedeemRequest({
          tokenId: card.tokenId,
          chainId,
          shipTo,
        });
        okCount += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Request failed";
        failures.push(`#${card.tokenId}: ${msg}`);
      }
    }

    await queryClient.invalidateQueries({
      queryKey: ["rwa", "redemptions", "mine"],
    });

    setBusy(false);
    setSuccessCount(okCount);

    if (okCount === 0) {
      setError(failures[0] ?? "Could not request redemption.");
      return;
    }

    if (failures.length > 0) {
      setError(
        `${okCount} requested. ${failures.length} failed: ${failures.slice(0, 2).join("; ")}`,
      );
    }

    clearRedeemDraft();
    setSubmitted(true);
    setStep("requested");
  }, [draft, form, runAccessGate, queryClient, chainId]);

  return useMemo(
    () => ({
      hydrated,
      draft,
      cards,
      step,
      form,
      setForm,
      busy,
      error,
      successCount,
      removeCard,
      submitRequest,
      goRequest: () => setStep("request"),
    }),
    [
      hydrated,
      draft,
      cards,
      step,
      form,
      busy,
      error,
      successCount,
      removeCard,
      submitRequest,
    ],
  );
}
