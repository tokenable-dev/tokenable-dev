"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  useAccount,
  useWriteContract,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { formatUnits, parseUnits, type Address } from "viem";
import type { Order } from "@/lib/api";
import { sepolia } from "@/config/wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TOKENABLE_RWA_ADDRESS,
  SEAPORT_ADDRESS,
  TOKENABLE_RWA_APPROVE_ABI,
} from "@/constants/contracts";
import { getMarketplaceCollectionDetail, getOrderByHash } from "@/lib/api";
import { rq } from "@/lib/queryKeys";
import { GAS_FALLBACK, gasWithCapFast } from "@/lib/chainGas";
import { mapWalletError } from "@/lib/walletError";
import { askGrossUsdcMicros, bidUsdcAmount } from "@/lib/seaport/bidUsdc";
import { isCriteriaCollectionBid } from "@/lib/seaport/criteriaMatch";
import {
  runCriteriaMatch,
  mapMatchError,
  type MatchWriteContractAsync,
} from "@/lib/seaport/runCriteriaMatch";
import {
  bidMerkleRootMatchesCollection,
  fetchMerkleSnapshotForMatch,
} from "@/lib/seaport/collectionCriteriaRoot";
import { normalizeDecimalTokenId } from "@/lib/normalizeTokenId";
import {
  getChainTimestampSec,
  isSeaportOrderActiveAt,
} from "@/lib/seaport/seaportOrderTime";
import { submitAskListingOrder } from "@/lib/seaport/submitAskListing";
import { feePercent } from "@/lib/seaport/platformFee";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;

/** Caps each marketplace HTTP call during instant-match so step 4 cannot hang forever. */
function matchFlowHttpSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(22_000);
  }
  return undefined;
}

function isAbortLikeError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  if (e.name === "AbortError" || e.name === "TimeoutError") return true;
  return (
    typeof DOMException !== "undefined" &&
    e instanceof DOMException &&
    e.name === "AbortError"
  );
}

function orderCollectionKey(o: Order | null | undefined): string {
  if (!o) return "";
  const any = o as Order & { collection_key?: string };
  const k = o.collectionKey ?? any.collection_key;
  return k != null ? String(k).trim() : "";
}

/**
 * Modal props sometimes omit `collectionKey` (e.g. My Assets), but the saved ask row has it —
 * use API fields so matchAdvancedOrders still runs after replace/create.
 */
function shortBidder(addr: string) {
  const a = addr.startsWith("0x") ? addr : `0x${addr}`;
  if (a.length <= 14) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function resolveMatchCollectionKey(
  created: Order,
  propKey: string | null | undefined,
  existingAsk?: Order | null,
  bids?: Order[],
): string | undefined {
  const a = orderCollectionKey(created);
  const b = propKey != null ? propKey.trim() : "";
  const c = orderCollectionKey(existingAsk ?? undefined);
  let fromBid = "";
  for (const x of bids ?? []) {
    if (x.status === "active" && isCriteriaCollectionBid(x)) {
      const k = orderCollectionKey(x);
      if (k) {
        fromBid = k;
        break;
      }
    }
  }
  return a || b || c || fromBid || undefined;
}

type Step =
  | "idle"
  | "approving"
  | "signing"
  | "submitting"
  | "matching"
  | "success"
  | "error";

interface ListSuccessMeta {
  matched: boolean;
  hint?: string;
}

interface ListRwaModalProps {
  tokenId: number;
  onClose: () => void;
  /** Listing immediately matched a collection bid (`matchAdvancedOrders` succeeded). */
  onMatchedSale?: () => void;
  onListed?: (tokenId: number) => void;
  /** 풀 최대가로 재리스트할 때 가격 필드에 미리 채움 (예: "3.00") */
  initialPriceUsdc?: string | null;
  /** Active ask to replace (e.g. lower price) — replace-listing, then instant collection-bid match. */
  existingAskOrder?: Order | null;
  /** When only a lightweight list row is available, pass hash — modal loads full Seaport order. */
  existingAskOrderHash?: string | null;
  /** With `collectionBids`, after you list we automatically run `matchAdvancedOrders` when your price crosses an eligible collection bid (no separate “instant match” step). */
  collectionKey?: string | null;
  collectionBids?: Order[];
  /** When set (e.g. order book bid row selected), try this bid first for `matchAdvancedOrders`. */
  preferredBidOrderHash?: string | null;
}

export function ListRwaModal({
  tokenId,
  onClose,
  onMatchedSale,
  onListed,
  initialPriceUsdc,
  existingAskOrder,
  existingAskOrderHash,
  collectionKey,
  collectionBids,
  preferredBidOrderHash,
}: ListRwaModalProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id });
  const walletClientRef = useRef(walletClient);
  walletClientRef.current = walletClient;
  const queryClient = useQueryClient();

  const { data: existingAskFetched } = useQuery({
    queryKey: ["orders", "detail", existingAskOrderHash ?? ""],
    queryFn: () => getOrderByHash(existingAskOrderHash!),
    enabled: Boolean(existingAskOrderHash?.trim()) && !existingAskOrder,
    staleTime: 15_000,
  });
  const resolvedExistingAsk = existingAskOrder ?? existingAskFetched ?? null;

  const [price, setPrice] = useState("");
  /** When several collection bids equal the list price exactly, seller picks which to try first. */
  const [tieBreakBidHash, setTieBreakBidHash] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMeta, setSuccessMeta] = useState<ListSuccessMeta | null>(null);

  /** Highest active criteria bid (including your own) — same wallet can bid + list; instant match still runs on-chain. */
  const topCollectionBid = useMemo(() => {
    if (!collectionBids?.length) return null;
    const rows = collectionBids.filter(
      (b) => b.status === "active" && isCriteriaCollectionBid(b),
    );
    if (!rows.length) return null;
    rows.sort((a, b) => {
      const da = bidUsdcAmount(a);
      const db = bidUsdcAmount(b);
      if (da > db) return -1;
      if (da < db) return 1;
      return 0;
    });
    const top = rows[0];
    const micros = bidUsdcAmount(top);
    let label: string;
    try {
      const n = Number(formatUnits(micros, 6));
      label = n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      label = String(micros);
    }
    return { micros, label, inputValue: formatUnits(micros, 6) };
  }, [collectionBids, address]);

  const askMicrosFromPrice = useMemo(() => {
    const t = price.trim();
    if (!t) return null;
    const n = parseFloat(t);
    if (!Number.isFinite(n) || n <= 0) return null;
    try {
      return parseUnits(t, 6);
    } catch {
      return null;
    }
  }, [price]);

  const bidsAtExactListPrice = useMemo(() => {
    if (askMicrosFromPrice == null || !collectionBids?.length) return [];
    const ck = collectionKey?.trim();
    return collectionBids.filter((b) => {
      if (b.status !== "active" || !isCriteriaCollectionBid(b)) return false;
      const bk = orderCollectionKey(b);
      if (ck && bk && bk.toLowerCase() !== ck.toLowerCase()) return false;
      return bidUsdcAmount(b) === askMicrosFromPrice;
    });
  }, [collectionBids, collectionKey, askMicrosFromPrice]);

  useEffect(() => {
    if (bidsAtExactListPrice.length < 2) {
      setTieBreakBidHash(null);
      return;
    }
    const hashes = bidsAtExactListPrice.map((b) => String(b.orderHash));
    setTieBreakBidHash((prev) =>
      prev && hashes.includes(prev) ? prev : hashes[0] ?? null,
    );
  }, [bidsAtExactListPrice]);

  const preferredBidForMatch = useMemo(() => {
    if (bidsAtExactListPrice.length >= 2 && tieBreakBidHash) return tieBreakBidHash;
    return preferredBidOrderHash ?? null;
  }, [bidsAtExactListPrice.length, tieBreakBidHash, preferredBidOrderHash]);

  const isReplaceListing = useMemo(() => {
    if (!resolvedExistingAsk || !address) return false;
    if (resolvedExistingAsk.side !== "ask" || resolvedExistingAsk.status !== "active")
      return false;
    if (Number(normalizeDecimalTokenId(resolvedExistingAsk.tokenId)) !== Number(tokenId)) {
      return false;
    }
    return resolvedExistingAsk.offerer.toLowerCase() === address.toLowerCase();
  }, [resolvedExistingAsk, address, tokenId]);

  /** Live book price before this edit — drives “$5 ask vs $4 bid” UX. */
  const currentAskDisplay = useMemo(() => {
    if (!isReplaceListing || !resolvedExistingAsk?.considerationAmount) return null;
    try {
      const micros = BigInt(resolvedExistingAsk.considerationAmount);
      const n = Number(formatUnits(micros, 6));
      if (!Number.isFinite(n)) return null;
      const label = n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return { micros, label, inputValue: formatUnits(micros, 6) };
    } catch {
      return null;
    }
  }, [isReplaceListing, resolvedExistingAsk?.considerationAmount]);

  /** After success, close the modal — short delay so instant-match copy is readable when parent keeps the modal mounted. */
  useEffect(() => {
    if (step !== "success") return;
    const delayMs = successMeta?.matched
      ? 1800
      : successMeta?.hint
        ? 4200
        : 900;
    const id = window.setTimeout(() => onClose(), delayMs);
    return () => window.clearTimeout(id);
  }, [step, successMeta?.matched, successMeta?.hint, onClose]);

  useEffect(() => {
    if (initialPriceUsdc != null && initialPriceUsdc.trim() !== "") {
      setPrice(initialPriceUsdc.trim());
      return;
    }
    if (resolvedExistingAsk?.considerationAmount) {
      try {
        setPrice(formatUnits(BigInt(resolvedExistingAsk.considerationAmount), 6));
      } catch {
        setPrice("");
      }
      return;
    }
    setPrice("");
  }, [initialPriceUsdc, tokenId, resolvedExistingAsk?.orderHash]);

  const { writeContractAsync } = useWriteContract();

  function mergeBidsByOrderHash(api: Order[], hints: Order[]): Order[] {
    const m = new Map<string, Order>();
    for (const b of api) {
      if (b?.orderHash) m.set(b.orderHash, b);
    }
    for (const b of hints) {
      if (b?.orderHash && !m.has(b.orderHash)) m.set(b.orderHash, b);
    }
    return [...m.values()];
  }

  /**
   * Highest USDC bid first. If `preferred` is set, it only moves to the front **within the same
   * bid amount** (tie-break for multiple buyers at one price) — never before a strictly higher bid.
   */
  function orderMatchCandidates(merkleOk: Order[], preferred?: string | null): Order[] {
    const byPriceDesc = (a: Order, b: Order) => {
      const da = bidUsdcAmount(a);
      const db = bidUsdcAmount(b);
      if (da > db) return -1;
      if (da < db) return 1;
      return 0;
    };
    const sorted = [...merkleOk].sort(byPriceDesc);
    const p = preferred?.trim();
    if (!p) return sorted;

    const out: Order[] = [];
    let i = 0;
    while (i < sorted.length) {
      const tierPrice = bidUsdcAmount(sorted[i]!);
      const tier: Order[] = [];
      while (i < sorted.length && bidUsdcAmount(sorted[i]!) === tierPrice) {
        tier.push(sorted[i]!);
        i++;
      }
      const prefIdx = tier.findIndex((b) => b.orderHash === p);
      if (prefIdx > 0) {
        const pref = tier[prefIdx]!;
        out.push(pref, ...tier.filter((_, j) => j !== prefIdx));
      } else {
        out.push(...tier);
      }
    }
    return out;
  }

  /**
   * List-then-instant-match: refetch bids + Merkle with retries (indexing lag), optional multi-round,
   * and preferred bid hash (from order book) first.
   */
  /**
   * `tryMatchAfterListing` can run a long time (Merkle retries, RPC) or wait on a **second**
   * wallet tx for `matchAdvancedOrders`. Never block the modal forever — cap wall time and still show success.
   */
  async function tryMatchAfterListingWithTimeout(
    created: Order,
  ): Promise<ListSuccessMeta> {
    /** Cap “Processing…” so the UI always reaches the success screen (listing is already on-chain). */
    const timeoutMs = 90_000;
    return Promise.race([
      tryMatchAfterListing(created),
      new Promise<ListSuccessMeta>((resolve) =>
        setTimeout(
          () =>
            resolve({
              matched: false,
              hint:
                "Automatic bid matching took too long (indexing) or is waiting on another wallet confirmation. Your listing is already saved — refresh this page or match from the collection order book.",
            }),
          timeoutMs,
        ),
      ),
    ]);
  }

  async function resolveCollectionKeyForMatch(created: Order): Promise<string | undefined> {
    let key = resolveMatchCollectionKey(
      created,
      collectionKey,
      resolvedExistingAsk,
      collectionBids,
    );
    if (!key && created.orderHash) {
      try {
        const refreshed = await getOrderByHash(created.orderHash, {
          signal: matchFlowHttpSignal(),
        });
        key = resolveMatchCollectionKey(
          refreshed,
          collectionKey,
          resolvedExistingAsk,
          collectionBids,
        );
      } catch {
        /* keep */
      }
    }
    if (!key && collectionKey != null && String(collectionKey).trim() !== "") {
      key = String(collectionKey).trim();
    }
    return key;
  }

  /**
   * When false, there is no collection bid ≥ list price (after one fresh API read) — skip step 4 and
   * Merkle polling; listing is already on the order book.
   */
  async function shouldRunInstantMatchAfterList(created: Order): Promise<boolean> {
    const key = await resolveCollectionKeyForMatch(created);
    if (!key || !address || !publicClient) return false;
    const askAm = askGrossUsdcMicros(created);
    const propBids = collectionBids ?? [];
    const crosses = (rows: Order[]) =>
      rows.some((b) => {
        if (b.status !== "active" || !isCriteriaCollectionBid(b)) return false;
        const bk = orderCollectionKey(b);
        if (bk && bk.toLowerCase() !== key.toLowerCase()) return false;
        return bidUsdcAmount(b) >= askAm;
      });
    const uiSaysCross =
      topCollectionBid != null && topCollectionBid.micros >= askAm;
    if (uiSaysCross || crosses(propBids)) return true;
    let detail: Awaited<ReturnType<typeof getMarketplaceCollectionDetail>> | null = null;
    try {
      detail = await getMarketplaceCollectionDetail(key, {
        bypassCache: true,
        signal: matchFlowHttpSignal(),
      });
    } catch (e) {
      if (!isAbortLikeError(e)) throw e;
    }
    const merged = mergeBidsByOrderHash(detail?.collectionBids ?? [], propBids);
    return crosses(merged);
  }

  async function tryMatchAfterListing(created: Order): Promise<ListSuccessMeta> {
    const key = await resolveCollectionKeyForMatch(created);
    if (!key || !address || !publicClient) {
      return { matched: false };
    }

    const propBids = collectionBids ?? [];
    const askAm = askGrossUsdcMicros(created);
    const matchWrite = ((args: Parameters<MatchWriteContractAsync>[0]) =>
      writeContractAsync(
        args as Parameters<typeof writeContractAsync>[0],
      )) as MatchWriteContractAsync;

    const bidCrossesAsk = (rows: Order[]) =>
      rows.some((b) => {
        if (b.status !== "active" || !isCriteriaCollectionBid(b)) return false;
        const bk = orderCollectionKey(b);
        if (bk && bk.toLowerCase() !== key.toLowerCase()) return false;
        return bidUsdcAmount(b) >= askAm;
      });

    /** UI or props already show a crossing bid — poll API/Merkle with shorter gaps. */
    const hotPath =
      bidCrossesAsk(propBids) ||
      (topCollectionBid != null && topCollectionBid.micros >= askAm);

    const maxMatchRounds = 3;
    let lastMeta: ListSuccessMeta = { matched: false };

    for (let round = 0; round < maxMatchRounds; round++) {
      if (round > 0) {
        await new Promise((r) => setTimeout(r, 200 * round));
        await queryClient.invalidateQueries({ queryKey: ["marketplace-collection", key] });
        await queryClient.invalidateQueries({ queryKey: ["merkle-set", key] });
        await queryClient.invalidateQueries({ queryKey: ["merkle-set"] });
      }

      let bids: Order[] = [];
      const detailAttempts = hotPath ? 8 : 12;
      for (let attempt = 0; attempt < detailAttempts; attempt++) {
        let detail: Awaited<ReturnType<typeof getMarketplaceCollectionDetail>> | null = null;
        try {
          detail = await getMarketplaceCollectionDetail(key, {
            bypassCache: true,
            signal: matchFlowHttpSignal(),
          });
        } catch (e) {
          if (isAbortLikeError(e)) {
            detail = null;
          } else {
            throw e;
          }
        }
        const fromApi = detail?.collectionBids ?? [];
        bids = mergeBidsByOrderHash(fromApi, propBids);

        if (bids.length > 0) {
          const hasCrossing = bids.some((b) => {
            if (b.status !== "active" || !isCriteriaCollectionBid(b)) return false;
            const bk = orderCollectionKey(b);
            if (bk && bk.toLowerCase() !== key.toLowerCase()) return false;
            return bidUsdcAmount(b) >= askAm;
          });
          if (hasCrossing) break;
        }

        if (attempt < detailAttempts - 1) {
          const gapMs = hotPath ? 55 + attempt * 22 : 120 + attempt * 35;
          await new Promise((r) => setTimeout(r, gapMs));
        }
      }

      if (!bids.length) {
        lastMeta = { matched: false };
        continue;
      }

      const merkleSnap = await fetchMerkleSnapshotForMatch(key, {
        expectTokenId: tokenId,
        maxAttempts: hotPath ? 18 : 14,
        delayMs: hotPath ? 110 : 200,
        bypassMerkleCache: true,
      });

      if (!merkleSnap?.tokenIds.length) {
        lastMeta = {
          matched: false,
          hint:
            "Your listing is not in the collection Merkle set yet (indexing delay). Retrying… If this persists, open this collection again in a few seconds.",
        };
        continue;
      }

      const { tokenIds: merkleTokenIds, rootHex: currentRoot } = merkleSnap;

      const pricedBids = bids.filter((b) => {
        if (b.status !== "active" || !isCriteriaCollectionBid(b)) return false;
        const bk = orderCollectionKey(b);
        if (bk && bk.toLowerCase() !== key.toLowerCase()) return false;
        return bidUsdcAmount(b) >= askAm;
      });

      if (pricedBids.length === 0) {
        const hasCriteriaBids = bids.some(
          (b) => b.status === "active" && isCriteriaCollectionBid(b),
        );
        lastMeta = {
          matched: false,
          hint: hasCriteriaBids
            ? "There are collection bids, but none at or above your list price. Try the bid price or lower."
            : undefined,
        };
        if (hasCriteriaBids) break;
        // No collection bids in this pool — listing is on the book; don’t spin rounds.
        break;
      }

      const merkleOk = pricedBids.filter((b) =>
        bidMerkleRootMatchesCollection(b, currentRoot),
      );
      const candidates = orderMatchCandidates(merkleOk, preferredBidForMatch);

      if (candidates.length === 0) {
        lastMeta = {
          matched: false,
          hint:
            "No bid’s Merkle root matches the server’s current leaf set. The buyer must cancel and re-place their collection bid after pool updates, then list again (or use Match on the token page).",
        };
        continue;
      }

      let lastErr = "";
      let listing: Order = created;

      for (const bid of candidates) {
        try {
          const chainNow = await getChainTimestampSec(publicClient);
          if (!isSeaportOrderActiveAt(listing, chainNow)) {
            const wc = walletClientRef.current;
            if (!wc) {
              lastErr =
                "Wallet signer not ready — unlock your wallet, then try again so the listing can be refreshed.";
              continue;
            }
            listing = await submitAskListingOrder({
              tokenId,
              priceUsdc: formatUnits(askGrossUsdcMicros(listing), 6),
              address: address as Address,
              publicClient,
              walletClient: wc,
              writeContractAsync: writeContractAsync as Parameters<
                typeof submitAskListingOrder
              >[0]["writeContractAsync"],
              mode: "replace",
              oldOrderHash: listing.orderHash,
            });
          }
          if (askGrossUsdcMicros(listing) > bidUsdcAmount(bid)) {
            const wc = walletClientRef.current;
            if (!wc) {
              lastErr =
                "Wallet signer not ready — unlock your wallet, then change the list price to the bid or try again.";
              continue;
            }
            listing = await submitAskListingOrder({
              tokenId,
              priceUsdc: formatUnits(bidUsdcAmount(bid), 6),
              address: address as Address,
              publicClient,
              walletClient: wc,
              writeContractAsync: writeContractAsync as Parameters<
                typeof submitAskListingOrder
              >[0]["writeContractAsync"],
              mode: "replace",
              oldOrderHash: listing.orderHash,
            });
          }

          await runCriteriaMatch({
            address: address as Address,
            publicClient,
            writeContractAsync: matchWrite,
            bid,
            listing,
            tokenId,
            collectionKey: key,
            merkleTokenIds,
          });

          return { matched: true };
        } catch (e: unknown) {
          lastErr = mapMatchError(e, { bidOfferer: bid.offerer });
        }
      }

      const merkleHint = lastErr.toLowerCase().includes("merkle")
        ? " If this persists, the buyer may need to cancel and re-place their collection bid for the updated listing set."
        : "";

      lastMeta = {
        matched: false,
        hint: lastErr
          ? `${lastErr}${merkleHint}`
          : "Could not fill a collection bid automatically.",
      };
    }

    return lastMeta;
  }

  async function invalidateListingQueries(created: Order) {
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
    await queryClient.invalidateQueries({ queryKey: ["rwa-metadata-batch"] });
    await queryClient.invalidateQueries({ queryKey: ["poketrace-mint-previews"] });
    await queryClient.invalidateQueries({ queryKey: rq.collectionsMarketplace() });
    await queryClient.invalidateQueries({ queryKey: ["collection-snapshots"] });
    await queryClient.invalidateQueries({ queryKey: ["marketplace-collection"] });
    await queryClient.invalidateQueries({ queryKey: ["merkle-set"] });
    const colKey =
      orderCollectionKey(created) ||
      (collectionKey != null ? collectionKey.trim() : "") ||
      orderCollectionKey(resolvedExistingAsk);
    if (colKey) {
      await queryClient.invalidateQueries({ queryKey: ["merkle-set", colKey] });
    }
    if (address) {
      await queryClient.invalidateQueries({ queryKey: rq.rwaTokens(address) });
    }
  }

  async function handleList() {
    if (!address || !price || parseFloat(price) <= 0) return;
    if (!walletClient) {
      setErrorMsg("Wallet not connected. Please reconnect.");
      return;
    }
    if (!publicClient) {
      setErrorMsg("Network not ready. Try again.");
      return;
    }

    setErrorMsg("");
    setSuccessMeta(null);

    try {
      if (isReplaceListing && resolvedExistingAsk) {
        setStep("submitting");
        let created = await submitAskListingOrder({
          tokenId,
          priceUsdc: price.trim(),
          address: address as Address,
          publicClient,
          walletClient,
          writeContractAsync: writeContractAsync as Parameters<
            typeof submitAskListingOrder
          >[0]["writeContractAsync"],
          mode: "replace",
          oldOrderHash: resolvedExistingAsk.orderHash,
        });
        if (!orderCollectionKey(created) && created.orderHash) {
          try {
            const refreshed = await getOrderByHash(created.orderHash);
            if (orderCollectionKey(refreshed)) created = refreshed;
          } catch {
            /* keep created */
          }
        }

        let meta: ListSuccessMeta;
        const runInstantMatch = await shouldRunInstantMatchAfterList(created);
        if (runInstantMatch) {
          setStep("matching");
          {
            const ck = collectionKey?.trim();
            if (ck) {
              await queryClient.invalidateQueries({ queryKey: ["marketplace-collection", ck] });
              await queryClient.invalidateQueries({ queryKey: ["merkle-set", ck] });
              await queryClient.invalidateQueries({ queryKey: ["merkle-set"] });
            }
          }
          meta = await tryMatchAfterListingWithTimeout(created);
        } else {
          meta = { matched: false };
        }
        if (meta.matched) {
          onMatchedSale?.();
        }

        onListed?.(tokenId);
        setSuccessMeta(meta);
        setStep("success");
        await invalidateListingQueries(created);
        return;
      }

      // ── Step 1: OpenSea-style setApprovalForAll(Seaport, true) — 한 번이면 전 토큰 리스팅 가능
      const alreadyAll = await publicClient.readContract({
        address: TOKENABLE_RWA_ADDRESS,
        abi: TOKENABLE_RWA_APPROVE_ABI,
        functionName: "isApprovedForAll",
        args: [address, SEAPORT_ADDRESS],
      });
      if (!alreadyAll) {
        setStep("approving");
               const gasSetAll = await gasWithCapFast(
          publicClient,
          {
            address: TOKENABLE_RWA_ADDRESS,
            abi: TOKENABLE_RWA_APPROVE_ABI,
            functionName: "setApprovalForAll",
            args: [SEAPORT_ADDRESS, true],
            account: address,
          },
          GAS_FALLBACK.setApprovalForAll,
        );
        const setAllTx = await writeContractAsync({
          address: TOKENABLE_RWA_ADDRESS,
          abi: TOKENABLE_RWA_APPROVE_ABI,
          functionName: "setApprovalForAll",
          args: [SEAPORT_ADDRESS, true],
          chainId: sepolia.id,
          gas: gasSetAll,
        });
        await publicClient.waitForTransactionReceipt({ hash: setAllTx });
      }

      // Sign + POST: same code path as price replace (`submitAskListingOrder`) so counter / startTime / salt
      // are read together after any approval wait — avoids a mismatched first-listing signature vs replace.
      setStep("signing");
      const wc = walletClientRef.current ?? walletClient;
      if (!wc) {
        setErrorMsg("Wallet not connected. Please reconnect.");
        setStep("error");
        return;
      }

      let createdFinal = await submitAskListingOrder({
        tokenId,
        priceUsdc: price.trim(),
        address: address as Address,
        publicClient,
        walletClient: wc,
        writeContractAsync: writeContractAsync as Parameters<
          typeof submitAskListingOrder
        >[0]["writeContractAsync"],
        mode: "create",
      });
      if (!orderCollectionKey(createdFinal) && createdFinal.orderHash) {
        try {
          const refreshed = await getOrderByHash(createdFinal.orderHash);
          if (orderCollectionKey(refreshed)) createdFinal = refreshed;
        } catch {
          /* keep created */
        }
      }

      let meta: ListSuccessMeta;
      const runInstantMatch = await shouldRunInstantMatchAfterList(createdFinal);
      if (runInstantMatch) {
        setStep("matching");
        {
          const ck = collectionKey?.trim();
          if (ck) {
            await queryClient.invalidateQueries({ queryKey: ["marketplace-collection", ck] });
            await queryClient.invalidateQueries({ queryKey: ["merkle-set", ck] });
            await queryClient.invalidateQueries({ queryKey: ["merkle-set"] });
          }
        }
        meta = await tryMatchAfterListingWithTimeout(createdFinal);
      } else {
        meta = { matched: false };
      }
      if (meta.matched) {
        onMatchedSale?.();
      }

      onListed?.(tokenId);
      setSuccessMeta(meta);
      setStep("success");

      await invalidateListingQueries(createdFinal);
    } catch (err: unknown) {
      setErrorMsg(mapWalletError(err).message);
      setStep("error");
    }
  }

  const isProcessing =
    step === "approving" ||
    step === "signing" ||
    step === "submitting" ||
    step === "matching";

  const showMatchStep = Boolean(
    collectionKey?.trim() ||
      orderCollectionKey(resolvedExistingAsk) ||
      topCollectionBid != null,
  );
  const stepLabels: { label: string; active: boolean }[] = [
    { label: "1. Approve marketplace", active: step === "approving" },
    { label: "2. Sign Order", active: step === "signing" },
    { label: "3. Submitting", active: step === "submitting" },
    ...(showMatchStep
      ? [{ label: "4. Instant match (if bid)", active: step === "matching" }]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-5 sm:px-6 sm:py-8">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex w-full max-w-[min(100%,22rem)] flex-col rounded-2xl border border-zinc-700/90 bg-zinc-950 px-6 py-6 shadow-xl shadow-black/40 sm:py-8">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 rounded-lg p-1 text-sm text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200 sm:right-4 sm:top-4"
        >
          ✕
        </button>

        {step === "success" ? (
          <div className="flex flex-col px-0 pb-1 pt-1 text-center sm:pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mint/85">
              {successMeta?.matched ? "Sold" : isReplaceListing ? "Updated" : "Listed"}
            </p>
            <div className="mb-2 mt-2 text-3xl leading-none">
              {successMeta?.matched ? "✓" : "🎉"}
            </div>
            <h3 className="text-base font-semibold tracking-tight text-white mb-1">
              {successMeta?.matched
                ? "Matched a collection bid"
                : isReplaceListing
                  ? "Listing updated"
                  : "Listed successfully"}
            </h3>
            <p className="text-[13px] leading-relaxed text-zinc-400">
              {successMeta?.matched
                ? `Asset #${tokenId} sold via matchAdvancedOrders (check your wallet for USDC).`
                : isReplaceListing
                  ? `Asset #${tokenId} ask is now ${price} USDC.`
                  : `Asset #${tokenId} is now listed for ${price} USDC`}
            </p>
            {!successMeta?.matched && feePercent() > 0 && (
              <p className="text-xs text-zinc-500 mt-2">
                {feePercent()}% platform fee included · You&apos;ll receive{" "}
                {(parseFloat(price) * (1 - feePercent() / 100)).toFixed(2)} USDC on sale
              </p>
            )}
            {!successMeta?.matched && (
              <p className="text-[11px] text-zinc-600 mt-2">Listing valid for 30 days</p>
            )}
            {!successMeta?.matched && successMeta?.hint ? (
              <p className="text-[11px] text-amber-200/90 mt-3 text-left leading-relaxed rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2.5">
                A collection bid at or above your price was found, but it could not be filled
                automatically. {successMeta.hint}
              </p>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-xl border border-zinc-600/80 bg-zinc-800/90 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-700"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-5 pt-1">
            <header className="flex gap-3 border-b border-white/[0.06] pb-4">
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mint/90">
                  {isReplaceListing ? "Update listing" : "New listing"}
                </p>
                <h2 className="text-lg font-semibold tracking-tight text-white sm:text-[1.125rem]">
                  Asset #{tokenId}
                </h2>
                <p className="text-[13px] leading-relaxed text-zinc-500">
                  {isReplaceListing
                    ? "Set a new USDC price. Your existing ask will be replaced on the order book."
                    : "Choose a USDC price. The listing is published through Seaport."}
                </p>
              </div>
              {/* Reserve same width as close control so title lines align with body below */}
              <div className="w-7 shrink-0 sm:w-8" aria-hidden />
            </header>

            {currentAskDisplay ? (
              <div className="rounded-xl border border-zinc-600/60 bg-zinc-900/60 px-3.5 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  Current ask
                </p>
                <p className="mt-1.5 text-base font-semibold tabular-nums text-white">
                  <span className="text-zinc-500 text-sm font-normal mr-0.5">$</span>
                  {currentAskDisplay.label}
                  <span className="text-zinc-500 font-normal text-xs ml-1.5">USDC</span>
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-400">
                {isReplaceListing ? "New price" : "Your price"}
                <span className="ml-1 font-normal text-zinc-600">(USDC)</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={isProcessing}
                  className="w-full rounded-xl border border-zinc-600/80 bg-zinc-900/80 px-4 py-2.5 pr-16 text-[15px] tabular-nums text-white outline-none ring-mint/0 transition-[border,box-shadow] placeholder:text-zinc-600 focus:border-mint/70 focus:ring-2 focus:ring-mint/20 disabled:opacity-60"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  USDC
                </span>
              </div>
              {price && parseFloat(price) > 0 && feePercent() > 0 && (
                <div className="mt-3 space-y-1.5 rounded-lg border border-zinc-700/50 bg-zinc-900/40 px-3 py-2.5 text-[11px]">
                  <div className="flex justify-between gap-2 text-zinc-500">
                    <span>Platform fee ({feePercent()}%)</span>
                    <span className="font-mono text-zinc-400 tabular-nums">
                      {(parseFloat(price) * feePercent() / 100).toFixed(2)} USDC
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 border-t border-zinc-700/40 pt-1.5 text-zinc-500">
                    <span className="text-zinc-400">You receive</span>
                    <span className="font-mono font-medium tabular-nums text-white">
                      {(parseFloat(price) * (1 - feePercent() / 100)).toFixed(2)} USDC
                    </span>
                  </div>
                </div>
              )}
            </div>

            {bidsAtExactListPrice.length >= 2 && tieBreakBidHash ? (
              <div className="rounded-xl border border-mint/25 bg-mint/[0.07] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-mint/95">
                  Same-price bids
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
                  {bidsAtExactListPrice.length} collection bids match this price. Pick which buyer to
                  try first (if that fill fails, others are tried).
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {bidsAtExactListPrice.map((b) => {
                    const id = String(b.orderHash);
                    const selected = tieBreakBidHash === id;
                    return (
                      <li key={id}>
                        <label
                          className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                            selected
                              ? "border-mint/45 bg-mint/[0.1]"
                              : "border-zinc-600/50 bg-zinc-900/40 hover:border-zinc-500/60"
                          }`}
                        >
                          <input
                            type="radio"
                            name="tie-break-bid"
                            className="accent-mint"
                            checked={selected}
                            disabled={isProcessing}
                            onChange={() => setTieBreakBidHash(id)}
                          />
                          <span className="text-[12px] text-zinc-200">
                            Buyer{" "}
                            <span className="font-mono text-mint/90">
                              {shortBidder(b.offerer)}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div
              className={
                stepLabels.length === 3
                  ? "grid grid-cols-3 gap-1.5"
                  : "grid grid-cols-2 gap-1.5"
              }
            >
              {stepLabels.map(({ label, active }) => (
                <div
                  key={label}
                  className={`rounded-lg px-1.5 py-2 text-center text-[9px] font-medium leading-tight sm:text-[10px] sm:leading-snug ${
                    active
                      ? "bg-mint-dim text-mint-ink shadow-sm shadow-mint/10 animate-pulse"
                      : "border border-zinc-700/80 bg-zinc-900/50 text-zinc-500"
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>

            {step === "error" && errorMsg && (
              <div className="rounded-xl border border-red-500/35 bg-red-950/40 p-3">
                <p className="text-xs text-red-300/95 break-all">{errorMsg}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleList()}
              disabled={isProcessing || !price || parseFloat(price) <= 0}
              className="mt-0.5 w-full rounded-xl bg-gradient-to-r from-mint to-mint-dim py-3 text-sm font-semibold text-mint-ink shadow-md shadow-mint/10 transition-all hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isProcessing
                ? "Processing..."
                : isReplaceListing
                  ? "Update listing"
                  : "List for sale"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
