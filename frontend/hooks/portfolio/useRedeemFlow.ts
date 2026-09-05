"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAccessGate } from "@/hooks/auth/useAccessGate";
import { useAppChain } from "@/providers/AppChainProvider";
import {
  EMPTY_REDEEM_ADDRESS_FORM,
  buildRedeemStatusHref,
  clearRedeemDraft,
  clearRedeemShipmentReceived,
  clearSavedRedeemAddress,
  isRedeemPreparingPhase,
  isRedeemTransitPhase,
  markRedeemAddressMigrated,
  parseRedeemViewQuery,
  readRedeemDraft,
  redeemViewForStatus,
  readSavedRedeemAddress,
  writeRedeemDraft,
  writeSavedRedeemAddress,
  type RedeemAddressForm,
  type RedeemDraft,
  type RedeemDraftCard,
} from "@/lib/portfolio/redeemDraft";
import {
  clearRedeemCustodyPending,
  readRedeemCustodyPending,
  writeRedeemCustodyPending,
  type RedeemCustodyPending,
} from "@/lib/portfolio/redeemCustodyPending";
import { buildRedeemShipments, type RedeemShipmentView } from "@/lib/portfolio/buildRedeemShipments";
import { enrichRedeemDraftCards } from "@/lib/portfolio/enrichRedeemDraftCards";
import {
  defaultVaultLabelForShipment,
  redeemShipmentKey,
} from "@/lib/portfolio/redeemShipmentKey";
import {
  getMyRedemptions,
  getRedeemCustodyWallet,
  getRedeemEstimate,
  postRedeemBatch,
  postRedeemBatchConfirmReceived,
  postRedeemBatchCustody,
  type RedeemShipTo,
} from "@/lib/core/api/rwa-redeem";
import { getPartnerMe } from "@/lib/core/api/marketplace-partner-me";
import {
  listShippingAddresses,
  upsertDefaultShippingAddress,
  type ShippingCountry,
} from "@/lib/core/api/shipping-addresses";
import { useAuthStore } from "@/store/authStore";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { getAddress, isAddress, formatUnits } from "viem";
import { getChainContracts } from "@/lib/chains/registry";
import {
  PLATFORM_FEE_RECIPIENT,
  TOKENABLE_RWA_READ_ABI,
  TOKENABLE_RWA_TRANSFER_ABI,
  USDC_ABI,
} from "@/constants/contracts";
import { useAppStore } from "@/store";
import {
  phoneDialLensFor,
  PHONE_DIAL_CODE_VALUES,
} from "@/lib/shipping/phoneDialOptions";
import {
  composeShipToPhone,
  firstShipToErrorKey,
  splitShipToPhone,
  validateShipToFields,
} from "@/lib/shipping/shipToValidation";
import { redeemDestinationCountryCode } from "@/lib/shipping/redeemDestinationCountryCode";
import { mapWalletError } from "@/lib/network/walletError";
import { waitForUserTxReceipt } from "@/lib/network";

/** Pay-first UI: address → pay (+ user-signed NFT custody) → preparing → transit → done. */
export type RedeemFlowStep =
  | "request"
  | "pay"
  | "preparing"
  | "transit"
  | "done";

/** Which wallet interaction is in flight — drives button labels + signing hints. */
export type RedeemPayPhase =
  | { kind: "quote" }
  | { kind: "pay" }
  | { kind: "record" }
  | { kind: "custody"; current: number; total: number }
  | null;

function validateShipTo(form: RedeemAddressForm): string | null {
  const errors = validateShipToFields({
    name: form.name,
    line1: form.line1,
    city: form.city,
    region: form.region ?? "",
    postal: form.postal,
    country: form.country,
    phone: form.phone,
    phoneDial: form.phoneDial || "+1",
    phoneDialLens: phoneDialLensFor(form.phoneDial || "+1"),
  });
  const first = firstShipToErrorKey(errors);
  return first ? errors[first]! : null;
}

/** After USDC is charged, never reopen Review and pay. Resume (NFT transfer) is not "charged done". */
function bestChargedView(
  rows: Array<{
    status: string;
    trackingNumber?: string | null;
    paymentBatchId?: string | null;
  }>,
): { view: "transit" | "preparing" | "done"; batchId: string | null } | null {
  if (rows.length === 0) return null;
  if (
    rows.some((r) => redeemViewForStatus(r.status, r.trackingNumber) === "resume")
  ) {
    return null;
  }
  for (const view of ["transit", "preparing", "done"] as const) {
    const hit = rows.find(
      (r) => redeemViewForStatus(r.status, r.trackingNumber) === view,
    );
    if (hit) {
      const batchId =
        hit.paymentBatchId?.trim() ||
        rows.find((r) => r.paymentBatchId?.trim())?.paymentBatchId?.trim() ||
        null;
      return { view, batchId };
    }
  }
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
    countryCode: redeemDestinationCountryCode({
      country: form.country,
      phoneDial: form.phoneDial || "+1",
    }),
    phone: composeShipToPhone(
      form.phoneDial || "+1",
      form.phone,
      PHONE_DIAL_CODE_VALUES,
    ),
  };
}

function formFromShipTo(shipTo: RedeemShipTo, saveAddress: boolean): RedeemAddressForm {
  const { phoneDial, phoneNational } = splitShipToPhone(
    shipTo.phone,
    PHONE_DIAL_CODE_VALUES,
  );
  return {
    ...EMPTY_REDEEM_ADDRESS_FORM,
    ...shipTo,
    phone: phoneNational,
    phoneDial,
    saveAddress,
  };
}

function shippingCountryFromIso(raw: string | null | undefined): ShippingCountry {
  const c = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (c === "us" || c === "usa") return "us";
  if (c === "ca" || c === "can") return "ca";
  if (c === "intl") return "intl";
  return "intl";
}

async function loadProfileAddressForm(
  userId: string | undefined,
): Promise<RedeemAddressForm> {
  if (!userId) {
    return { ...EMPTY_REDEEM_ADDRESS_FORM };
  }

  /* 1) Settings → Addresses default (personal ship-to book). */
  try {
    const rows = await listShippingAddresses();
    const def = rows.find((a) => a.isDefault) ?? rows[0] ?? null;
    if (def) {
      const shipTo: RedeemShipTo = {
        name: def.name,
        line1: def.line1,
        line2: def.line2 ?? undefined,
        city: def.city,
        region: def.region ?? undefined,
        postal: def.postal,
        country: def.country,
        phone: def.phone,
      };
      writeSavedRedeemAddress(shipTo, userId);
      markRedeemAddressMigrated(userId);
      return formFromShipTo(shipTo, true);
    }
  } catch {
    /* fall through */
  }

  /*
   * 2) Partner company Origin — partners often only have this on file.
   * Use contact + street as ship-to so Ship from vault isn't blank.
   */
  try {
    const me = await getPartnerMe();
    const origin = me.companyAddress;
    if (me.isPartner && origin) {
      const shipTo: RedeemShipTo = {
        name: origin.contactName.trim() || origin.companyName.trim(),
        line1: origin.line1,
        line2: origin.line2 ?? undefined,
        city: origin.city,
        region: origin.region ?? undefined,
        postal: origin.postal,
        country: shippingCountryFromIso(origin.country),
        phone: origin.phone,
      };
      writeSavedRedeemAddress(shipTo, userId);
      return formFromShipTo(shipTo, true);
    }
  } catch {
    /* fall through to local cache */
  }

  const local = readSavedRedeemAddress(userId);
  return local ?? { ...EMPTY_REDEEM_ADDRESS_FORM };
}

async function persistProfileAddressIfNeeded(
  form: RedeemAddressForm,
  userId: string | undefined,
): Promise<void> {
  const shipTo = toShipTo(form);
  if (form.saveAddress && userId) {
    await upsertDefaultShippingAddress({
      label: "Home",
      name: shipTo.name,
      line1: shipTo.line1,
      line2: shipTo.line2,
      city: shipTo.city,
      region: shipTo.region,
      postal: shipTo.postal,
      country: shipTo.country,
      phone: shipTo.phone,
      isDefault: true,
    });
    writeSavedRedeemAddress(shipTo, userId);
    markRedeemAddressMigrated(userId);
  } else if (!form.saveAddress) {
    clearSavedRedeemAddress();
  }
}

async function resolvePendingCustody(input: {
  chainId: number;
  tokenIds: number[];
}): Promise<RedeemCustodyPending | null> {
  const session = readRedeemCustodyPending();
  if (session && session.chainId === input.chainId) {
    return session;
  }

  const rows = await getMyRedemptions(input.chainId, input.tokenIds);
  const awaiting = rows.filter((r) => r.status === "ownership_verified");
  if (awaiting.length === 0) {
    clearRedeemCustodyPending();
    return null;
  }

  const batchId = awaiting[0]?.paymentBatchId?.trim();
  if (!batchId) return null;
  if (
    !awaiting.every(
      (r) => r.paymentBatchId === batchId && r.status === "ownership_verified",
    )
  ) {
    /* Mixed batches — only resume when all draft tokens share one paid batch. */
    const draftSet = new Set(input.tokenIds.map(String));
    const inBatch = awaiting.filter(
      (r) => r.paymentBatchId === batchId && draftSet.has(String(r.tokenId)),
    );
    if (inBatch.length === 0) return null;
  }

  const pendingIds = awaiting
    .filter((r) => r.paymentBatchId === batchId)
    .map((r) => Number(r.tokenId))
    .filter((n) => input.tokenIds.includes(n));
  if (pendingIds.length === 0) return null;

  const { custodyWalletAddress } = await getRedeemCustodyWallet(
    input.chainId as RedeemCustodyPending["chainId"],
  );
  const paymentTxHash = awaiting.find((r) => r.paymentBatchId === batchId)
    ?.paymentTxHash;
  if (!paymentTxHash || !isAddress(custodyWalletAddress)) return null;

  const pending: RedeemCustodyPending = {
    chainId: input.chainId as RedeemCustodyPending["chainId"],
    paymentBatchId: batchId,
    custodyWalletAddress: getAddress(custodyWalletAddress),
    paymentTxHash,
    tokenIds: pendingIds,
    savedAt: Date.now(),
  };
  writeRedeemCustodyPending(pending);
  return pending;
}

function cardsFromRedemptionRows(
  rows: Awaited<ReturnType<typeof getMyRedemptions>>,
  draftCards: RedeemDraftCard[],
): RedeemDraftCard[] {
  const byId = new Map(draftCards.map((c) => [c.tokenId, c]));
  return rows.map((r) => {
    const tid = Number(r.tokenId);
    const fromDraft = byId.get(tid);
    const key = redeemShipmentKey({
      settlementPolicy: r.settlementPolicy,
      vaultPartnerId: r.vaultPartnerId,
    });
    const vaultLabel = defaultVaultLabelForShipment({ shipmentKey: key });
    return (
      fromDraft ?? {
        tokenId: tid,
        name: `RWA #${r.tokenId}`,
        imageUrl: null,
        grade: null,
        certNumber: null,
        vaultLabel,
      }
    );
  });
}

async function cardsFromRedemptionRowsEnriched(
  rows: Awaited<ReturnType<typeof getMyRedemptions>>,
  draftCards: RedeemDraftCard[],
): Promise<RedeemDraftCard[]> {
  return enrichRedeemDraftCards(cardsFromRedemptionRows(rows, draftCards));
}

function applyShipmentsFromRows(
  rows: Awaited<ReturnType<typeof getMyRedemptions>>,
  cards: RedeemDraftCard[],
): RedeemShipmentView[] {
  const cardsByTokenId = new Map(cards.map((c) => [c.tokenId, c]));
  const vaultLabelByTokenId = new Map(
    cards.map((c) => [c.tokenId, c.vaultLabel] as const),
  );
  return buildRedeemShipments({
    rows,
    cardsByTokenId,
    vaultLabelByTokenId,
  });
}

/** Portfolio deep-link: paid batch with NFT transfers still outstanding (no draft required). */
async function resolveOpenCustodyResume(chainId: number): Promise<{
  pending: RedeemCustodyPending;
  cards: RedeemDraftCard[];
} | null> {
  const session = readRedeemCustodyPending();
  const rows = await getMyRedemptions(chainId);
  const awaiting = rows.filter(
    (r) => r.status === "ownership_verified" && r.paymentBatchId?.trim(),
  );
  if (awaiting.length === 0) {
    clearRedeemCustodyPending();
    return null;
  }

  let batchId =
    session && session.chainId === chainId
      ? session.paymentBatchId
      : (awaiting[0]?.paymentBatchId?.trim() ?? "");
  if (!batchId) return null;

  let batchRows = awaiting.filter((r) => r.paymentBatchId === batchId);
  if (batchRows.length === 0) {
    batchId = awaiting[0]?.paymentBatchId?.trim() ?? "";
    if (!batchId) return null;
    batchRows = awaiting.filter((r) => r.paymentBatchId === batchId);
  }

  const draftCards = readRedeemDraft()?.cards ?? [];
  const cards = await enrichRedeemDraftCards(
    cardsFromRedemptionRows(batchRows, draftCards),
  );
  const tokenIds = cards.map((c) => c.tokenId);
  if (tokenIds.length === 0) return null;

  const pending =
    session &&
    session.chainId === chainId &&
    session.paymentBatchId === batchId
      ? { ...session, tokenIds }
      : await resolvePendingCustody({ chainId, tokenIds });
  if (!pending) return null;
  return { pending, cards };
}

export function useRedeemFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { chainId } = useAppChain();
  const { runAccessGate } = useAccessGate(2, "/portfolio/redeem");
  const userId = useAuthStore((s) => s.user?.id);
  const authReady = useAuthStore((s) => s.initialized);
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId });
  const { writeContractAsync } = useWriteContract();
  const usdcBalance = useAppStore((s) => s.usdcBalance);

  const viewParam = parseRedeemViewQuery(searchParams);
  const queryViewRaw = (
    searchParams.get("view") ||
    searchParams.get("state") ||
    ""
  ).trim();
  const batchParam = searchParams.get("batch")?.trim() || null;
  const usedHtmlStateAlias = Boolean(
    !searchParams.get("view")?.trim() && searchParams.get("state")?.trim(),
  );
  const shouldCanonicalizeUrl =
    usedHtmlStateAlias || queryViewRaw === "pay";

  const [draft, setDraft] = useState<RedeemDraft | null>(null);
  const [displayCards, setDisplayCards] = useState<RedeemDraftCard[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState<RedeemFlowStep>("request");
  const [form, setForm] = useState<RedeemAddressForm>(EMPTY_REDEEM_ADDRESS_FORM);
  const [busy, setBusy] = useState(false);
  const [payPhase, setPayPhase] = useState<RedeemPayPhase>(null);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [custodyPending, setCustodyPending] =
    useState<RedeemCustodyPending | null>(null);
  const [shipmentTracking, setShipmentTracking] = useState<{
    trackingNumber: string | null;
    trackingCarrier: string | null;
  }>({ trackingNumber: null, trackingCarrier: null });
  const [shipments, setShipments] = useState<RedeemShipmentView[]>([]);
  const [paymentBatchId, setPaymentBatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;

    async function hydrate() {
      const profileForm = await loadProfileAddressForm(userId);
      if (!cancelled) setForm(profileForm);

      if (viewParam === "transit" || viewParam === "done") {
        try {
          const rows = await getMyRedemptions(chainId);
          if (cancelled) return;
          const draftCards = readRedeemDraft()?.cards ?? [];
          const filtered = rows.filter((r) => {
            if (viewParam === "done") return r.status === "completed";
            return (
              isRedeemTransitPhase(r.status, r.trackingNumber) ||
              isRedeemPreparingPhase(r.status, r.trackingNumber)
            );
          });
          /* Prefer batches that already have at least one tracked card. */
          const trackedBatchIds = new Set(
            rows
              .filter((r) => r.trackingNumber?.trim() && r.paymentBatchId)
              .map((r) => r.paymentBatchId!),
          );
          const transitScope =
            trackedBatchIds.size > 0
              ? filtered.filter(
                  (r) =>
                    r.paymentBatchId && trackedBatchIds.has(r.paymentBatchId),
                )
              : filtered.filter((r) =>
                  isRedeemTransitPhase(r.status, r.trackingNumber),
                );
          const cards = await cardsFromRedemptionRowsEnriched(
            transitScope.length > 0 ? transitScope : filtered,
            draftCards,
          );
          let scopeRows = transitScope.length > 0 ? transitScope : filtered;
          const preferredBatch =
            (batchParam &&
            scopeRows.some((r) => r.paymentBatchId === batchParam)
              ? batchParam
              : null) ||
            scopeRows.find((r) => r.paymentBatchId?.trim())?.paymentBatchId ||
            null;
          if (preferredBatch) {
            scopeRows = scopeRows.filter(
              (r) => r.paymentBatchId === preferredBatch,
            );
          }
          const nextShipments = applyShipmentsFromRows(scopeRows, cards);
          setShipments(nextShipments);
          const tracked = scopeRows.find((r) => r.trackingNumber?.trim());
          setShipmentTracking({
            trackingNumber: tracked?.trackingNumber ?? null,
            trackingCarrier: tracked?.trackingCarrier ?? null,
          });
          const batchId =
            scopeRows.find((r) => r.paymentBatchId?.trim())?.paymentBatchId ??
            null;
          setPaymentBatchId(batchId);
          setDisplayCards(
            preferredBatch
              ? cards.filter((c) =>
                  scopeRows.some((r) => Number(r.tokenId) === c.tokenId),
                )
              : cards,
          );
          setStep(viewParam === "done" ? "done" : "transit");
          setSubmitted(true);
          setHydrated(true);
          if (typeof window !== "undefined") {
            const nextView = viewParam === "done" ? "done" : "transit";
            if (shouldCanonicalizeUrl || (batchId && batchParam !== batchId)) {
              router.replace(buildRedeemStatusHref(nextView, batchId));
            }
          }
          return;
        } catch {
          if (cancelled) return;
          setSubmitted(true);
          setStep(viewParam === "done" ? "done" : "transit");
          setHydrated(true);
          return;
        }
      }

      if (viewParam === "preparing" || viewParam === "resume") {
        try {
          const rows = await getMyRedemptions(chainId);
          if (cancelled) return;
          const draftCards = readRedeemDraft()?.cards ?? [];

          if (viewParam === "preparing") {
            const preparingRows = rows.filter((r) =>
              isRedeemPreparingPhase(r.status, r.trackingNumber),
            );
            const trackedRows = rows.filter((r) =>
              isRedeemTransitPhase(r.status, r.trackingNumber),
            );

            /* Any vault tracking → In transit (other vaults may still be preparing). */
            if (trackedRows.length > 0) {
              const batchIds = new Set(
                trackedRows
                  .map((r) => r.paymentBatchId)
                  .filter((id): id is string => Boolean(id)),
              );
              const scope = rows.filter(
                (r) =>
                  r.paymentBatchId &&
                  batchIds.has(r.paymentBatchId) &&
                  (isRedeemPreparingPhase(r.status, r.trackingNumber) ||
                    isRedeemTransitPhase(r.status, r.trackingNumber)),
              );
              const cards = await cardsFromRedemptionRowsEnriched(
                scope,
                draftCards,
              );
              setShipments(applyShipmentsFromRows(scope, cards));
              const tracked = scope.find((r) => r.trackingNumber?.trim());
              setShipmentTracking({
                trackingNumber: tracked?.trackingNumber ?? null,
                trackingCarrier: tracked?.trackingCarrier ?? null,
              });
              setPaymentBatchId(
                scope.find((r) => r.paymentBatchId?.trim())?.paymentBatchId ??
                  null,
              );
              setDisplayCards(cards);
              setStep("transit");
              setSubmitted(true);
              setHydrated(true);
              if (typeof window !== "undefined") {
                const bid =
                  scope.find((r) => r.paymentBatchId?.trim())?.paymentBatchId ??
                  null;
                router.replace(buildRedeemStatusHref("transit", bid));
              }
              return;
            }

            if (preparingRows.length > 0) {
              const preferredBatch =
                (batchParam &&
                preparingRows.some((r) => r.paymentBatchId === batchParam)
                  ? batchParam
                  : null) ||
                preparingRows.find((r) => r.paymentBatchId?.trim())
                  ?.paymentBatchId ||
                null;
              const scoped = preferredBatch
                ? preparingRows.filter(
                    (r) => r.paymentBatchId === preferredBatch,
                  )
                : preparingRows;
              const batchId =
                scoped.find((r) => r.paymentBatchId?.trim())?.paymentBatchId ??
                null;
              const cards = await cardsFromRedemptionRowsEnriched(
                scoped,
                draftCards,
              );
              setShipments(applyShipmentsFromRows(scoped, cards));
              setPaymentBatchId(batchId);
              setDisplayCards(cards);
              setStep("preparing");
              setSubmitted(true);
              setHydrated(true);
              if (
                typeof window !== "undefined" &&
                (shouldCanonicalizeUrl || (batchId && batchParam !== batchId))
              ) {
                router.replace(buildRedeemStatusHref("preparing", batchId));
              }
              return;
            }
            /* Wrong legacy deep-link while NFTs still need transfer — resume. */
          }

          const open = await resolveOpenCustodyResume(chainId);
          if (cancelled) return;
          if (open) {
            const nextDraft: RedeemDraft = {
              chainId: chainId as RedeemDraft["chainId"],
              cards: open.cards,
              savedAt: Date.now(),
            };
            writeRedeemDraft(nextDraft);
            setDraft(nextDraft);
            setDisplayCards(open.cards);
            setCustodyPending(open.pending);
            setStep("pay");
            setSubmitted(true);
            setHydrated(true);
            if (typeof window !== "undefined" && shouldCanonicalizeUrl) {
              router.replace(
                buildRedeemStatusHref("resume", open.pending.paymentBatchId),
              );
            }
            return;
          }

          setDisplayCards([]);
          setStep(viewParam === "resume" ? "pay" : "preparing");
          setSubmitted(true);
          setHydrated(true);
          return;
        } catch {
          if (cancelled) return;
          setSubmitted(true);
          setStep(viewParam === "resume" ? "pay" : "preparing");
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
        clearRedeemCustodyPending();
        setDraft(null);
        setHydrated(true);
        return;
      }
      setDraft(loaded);
      setDisplayCards(loaded.cards);

      try {
        const existing = await getMyRedemptions(
          chainId,
          loaded.cards.map((c) => c.tokenId),
        );
        if (cancelled) return;
        const charged = bestChargedView(existing);
        if (charged) {
          clearRedeemDraft();
          clearRedeemCustodyPending();
          setDraft(null);
          setDisplayCards([]);
          if (typeof window !== "undefined") {
            router.replace(
              buildRedeemStatusHref(charged.view, charged.batchId),
            );
          }
          return;
        }
      } catch {
        /* still allow a fresh pay from the draft */
      }

      try {
        const pending = await resolvePendingCustody({
          chainId,
          tokenIds: loaded.cards.map((c) => c.tokenId),
        });
        if (!cancelled && pending) {
          const enriched = await enrichRedeemDraftCards(loaded.cards);
          if (!cancelled) {
            setDisplayCards(enriched);
            setCustodyPending(pending);
            setStep("pay");
          }
        }
      } catch {
        /* ignore — user can still pay normally */
      }

      if (!cancelled) {
        setHydrated(true);
        if (
          typeof window !== "undefined" &&
          shouldCanonicalizeUrl &&
          viewParam === "request"
        ) {
          router.replace("/portfolio/redeem");
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [authReady, chainId, viewParam, batchParam, userId, router, shouldCanonicalizeUrl]);

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

  const goToPay = useCallback(async () => {
    if (!draft || draft.cards.length === 0) return;
    const validationError = validateShipTo(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await persistProfileAddressIfNeeded(form, userId);
      const existing = await getMyRedemptions(
        chainId,
        draft.cards.map((c) => c.tokenId),
      );
      const charged = bestChargedView(existing);
      if (charged) {
        clearRedeemDraft();
        clearRedeemCustodyPending();
        setDraft(null);
        setSubmitted(true);
        router.replace(buildRedeemStatusHref(charged.view, charged.batchId));
        return;
      }
      const pending = await resolvePendingCustody({
        chainId,
        tokenIds: draft.cards.map((c) => c.tokenId),
      });
      setCustodyPending(pending);
      setStep("pay");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save address to your profile.",
      );
    } finally {
      setBusy(false);
    }
  }, [draft, form, userId, chainId, router]);

  const finishCustodyTransfers = useCallback(
    async (pending: RedeemCustodyPending) => {
      if (!address || !publicClient) {
        throw new Error("Connect your wallet to finish NFT transfers.");
      }
      const custodyWallet = getAddress(pending.custodyWalletAddress);
      const userWallet = getAddress(address);
      const { rwaAddress } = getChainContracts(pending.chainId);
      const rows = await getMyRedemptions(pending.chainId, pending.tokenIds);
      const needTransfer = rows
        .filter(
          (r) =>
            r.status === "ownership_verified" &&
            r.paymentBatchId === pending.paymentBatchId,
        )
        .map((r) => Number(r.tokenId));

      if (needTransfer.length === 0) {
        /* DB already in_custody — confirm endpoint is idempotent. */
        const custody = await postRedeemBatchCustody({
          batchId: pending.paymentBatchId,
          chainId: pending.chainId,
          transfers: [],
        });
        clearRedeemCustodyPending();
        setCustodyPending(null);
        return {
          transferred: 0,
          paymentBatchId: pending.paymentBatchId,
          allInCustody: custody.allInCustody,
        };
      }

      const transfers: Array<{ tokenId: number; txHash: `0x${string}` }> = [];
      let transferIndex = 0;
      for (const tokenId of needTransfer) {
        transferIndex += 1;
        setPayPhase({
          kind: "custody",
          current: transferIndex,
          total: needTransfer.length,
        });
        const ownerRaw = await publicClient.readContract({
          address: rwaAddress,
          abi: TOKENABLE_RWA_READ_ABI,
          functionName: "ownerOf",
          args: [BigInt(tokenId)],
        });
        const owner = getAddress(ownerRaw as string);

        if (owner === custodyWallet) {
          /* Already transferred on-chain before custody API confirmed. */
          continue;
        }
        if (owner !== userWallet) {
          throw new Error(
            `Token #${tokenId} is not in your connected wallet (on-chain owner ${owner}). Connect the wallet that still holds it, then try again.`,
          );
        }

        const nftHash = await writeContractAsync({
          chainId: pending.chainId,
          address: rwaAddress,
          abi: TOKENABLE_RWA_TRANSFER_ABI,
          functionName: "safeTransferFrom",
          args: [userWallet, custodyWallet, BigInt(tokenId)],
        });
        await waitForUserTxReceipt(publicClient, nftHash);
        transfers.push({ tokenId, txHash: nftHash });
      }

      const custody = await postRedeemBatchCustody({
        batchId: pending.paymentBatchId,
        chainId: pending.chainId,
        transfers,
      });
      if (!custody.allInCustody) {
        throw new Error(
          "Not all NFTs are in custody yet. Keep confirming until every card is transferred.",
        );
      }

      clearRedeemCustodyPending();
      setCustodyPending(null);
      return {
        transferred: transfers.length,
        paymentBatchId: pending.paymentBatchId,
        allInCustody: true,
      };
    },
    [address, publicClient, writeContractAsync],
  );

  const resumeCustody = useCallback(async () => {
    if (!custodyPending) return;
    if (!runAccessGate()) return;
    if (!isConnected || !address) {
      setError("Connect your wallet to finish transferring NFTs into custody.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await finishCustodyTransfers(custodyPending);
      setPayPhase(null);
      await queryClient.invalidateQueries({
        queryKey: ["rwa", "redemptions", "mine"],
      });
      setBusy(false);
      setSuccessCount(result.transferred || custodyPending.tokenIds.length);
      const enriched = await enrichRedeemDraftCards(displayCards);
      setDisplayCards(enriched);
      setPaymentBatchId(custodyPending.paymentBatchId);
      clearRedeemDraft();
      setSubmitted(true);
      setStep("preparing");
      router.replace(
        buildRedeemStatusHref("preparing", custodyPending.paymentBatchId),
      );
    } catch (e) {
      setBusy(false);
      setPayPhase(null);
      const mapped = mapWalletError(e);
      if (mapped.code === "USER_REJECTED") {
        setError(
          "You cancelled the NFT transfer. Your USDC payment is already recorded — confirm again in your wallet to finish moving cards into custody.",
        );
        return;
      }
      setError(
        mapped.message && mapped.code !== "UNKNOWN"
          ? mapped.message
          : e instanceof Error
            ? e.message
            : "Could not finish NFT custody transfer.",
      );
    }
  }, [
    custodyPending,
    runAccessGate,
    isConnected,
    address,
    finishCustodyTransfers,
    queryClient,
    displayCards,
  ]);

  const submitPay = useCallback(async () => {
    if (custodyPending) {
      await resumeCustody();
      return;
    }
    if (!draft || draft.cards.length === 0) return;
    const validationError = validateShipTo(form);
    if (validationError) {
      setError(validationError);
      setStep("request");
      return;
    }
    if (!runAccessGate()) return;
    if (!isConnected || !address) {
      setError("Connect your wallet to pay the redeem fee in USDC.");
      return;
    }
    if (!publicClient) {
      setError("Wallet client not ready. Try again.");
      return;
    }

    const payTo =
      PLATFORM_FEE_RECIPIENT ??
      (undefined as `0x${string}` | undefined);
    if (!payTo) {
      setError(
        "Platform fee recipient is not configured (NEXT_PUBLIC_PLATFORM_FEE_RECIPIENT).",
      );
      return;
    }

    setBusy(true);
    setError(null);
    const shipTo = toShipTo(form);

    try {
      await persistProfileAddressIfNeeded(form, userId);
    } catch (e) {
      setBusy(false);
      setError(
        e instanceof Error
          ? e.message
          : "Could not save address to your profile.",
      );
      return;
    }

    let paymentRecorded = false;
    let paymentSent = false;
    try {
      const tokenIds = draft.cards.map((c) => c.tokenId);
      setPayPhase({ kind: "quote" });
      let estimate;
      try {
        estimate = await getRedeemEstimate({
          country: form.country,
          cardCount: tokenIds.length,
          tokenIds,
          chainId,
          shipTo,
        });
      } catch (quoteErr) {
        const detail =
          quoteErr instanceof Error ? quoteErr.message : String(quoteErr);
        throw new Error(`${detail} No payment was made — you can try again.`);
      }
      const amount = BigInt(estimate.totalUsdcMicros);
      if (usdcBalance < amount) {
        throw new Error(
          `Insufficient USDC. Need ${formatUnits(amount, 6)} USDC.`,
        );
      }

      setPayPhase({ kind: "pay" });
      const { usdcAddress } = getChainContracts(chainId);
      const hash = await writeContractAsync({
        chainId,
        address: usdcAddress,
        abi: USDC_ABI,
        functionName: "transfer",
        args: [payTo, amount],
      });
      paymentSent = true;
      await waitForUserTxReceipt(publicClient, hash);

      setPayPhase({ kind: "record" });
      let batch;
      try {
        batch = await postRedeemBatch({
          tokenIds,
          chainId,
          shipTo,
          paymentTxHash: hash,
        });
        paymentRecorded = true;
      } catch (batchErr) {
        const detail =
          batchErr instanceof Error ? batchErr.message : String(batchErr);
        throw new Error(
          `USDC payment succeeded (${hash}), but redeem recording failed: ${detail}. Do not pay again — retry with the same payment, or contact support with this tx hash.`,
        );
      }

      const custodyRaw = batch.custodyWalletAddress?.trim();
      if (!custodyRaw || !isAddress(custodyRaw)) {
        throw new Error(
          "Backend did not return a valid custody wallet address.",
        );
      }

      const pending: RedeemCustodyPending = {
        chainId,
        paymentBatchId: batch.paymentBatchId,
        custodyWalletAddress: getAddress(custodyRaw),
        paymentTxHash: hash,
        tokenIds,
        savedAt: Date.now(),
      };
      writeRedeemCustodyPending(pending);
      setCustodyPending(pending);

      await finishCustodyTransfers(pending);
      setPayPhase(null);

      await queryClient.invalidateQueries({
        queryKey: ["rwa", "redemptions", "mine"],
      });

      setBusy(false);
      setSuccessCount(batch.redemptions.length);
      setPaymentBatchId(batch.paymentBatchId);
      clearRedeemDraft();
      setSubmitted(true);
      setStep("preparing");
      router.replace(
        buildRedeemStatusHref("preparing", batch.paymentBatchId),
      );
    } catch (e) {
      setBusy(false);
      setPayPhase(null);
      const mapped = mapWalletError(e);
      if (mapped.code === "USER_REJECTED") {
        setError(
          paymentRecorded
            ? "You cancelled the NFT transfer. Your USDC payment is already recorded — use Finish NFT transfers below (do not pay again)."
            : paymentSent
              ? "You cancelled after the USDC payment was sent. Do not pay again — reload this page to resume with the same payment."
              : "You cancelled the wallet request. No payment was completed — try again when ready.",
        );
        return;
      }
      setError(
        mapped.message && mapped.code !== "UNKNOWN"
          ? mapped.message
          : e instanceof Error
            ? e.message
            : "Payment or redeem failed.",
      );
    }
  }, [
    custodyPending,
    resumeCustody,
    draft,
    form,
    runAccessGate,
    queryClient,
    chainId,
    userId,
    isConnected,
    address,
    publicClient,
    writeContractAsync,
    usdcBalance,
    finishCustodyTransfers,
  ]);

  const confirmReceived = useCallback(async () => {
    if (!paymentBatchId?.trim()) {
      setError("Missing payment batch — reopen status from Portfolio.");
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      await postRedeemBatchConfirmReceived(paymentBatchId, chainId);
      clearRedeemDraft();
      clearRedeemShipmentReceived(paymentBatchId);
      clearRedeemCustodyPending();
      void queryClient.invalidateQueries({
        queryKey: ["rwa", "redemptions", "mine"],
      });
      setStep("done");
      router.replace(buildRedeemStatusHref("done", paymentBatchId));
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not confirm receipt.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }, [paymentBatchId, chainId, queryClient, router]);

  return useMemo(
    () => ({
      hydrated,
      draft,
      cards,
      step,
      form,
      setForm,
      busy,
      payPhase,
      error,
      successCount,
      custodyPending,
      shipmentTracking,
      shipments,
      paymentBatchId,
      removeCard,
      goToPay,
      submitPay,
      resumeCustody,
      confirmReceived,
      goRequest: () => {
        setError(null);
        setStep("request");
      },
    }),
    [
      hydrated,
      draft,
      cards,
      step,
      form,
      busy,
      payPhase,
      error,
      successCount,
      custodyPending,
      shipmentTracking,
      shipments,
      paymentBatchId,
      removeCard,
      goToPay,
      submitPay,
      resumeCustody,
      confirmReceived,
    ],
  );
}
