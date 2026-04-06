"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWalletClient,
  useWriteContract,
} from "wagmi";
import { formatUnits, hexToBigInt, maxUint256, parseUnits } from "viem";
import { sepolia } from "@/config/wagmi";
import {
  SEAPORT_ADDRESS,
  SEAPORT_ABI,
  SEAPORT_ORDER_TYPES,
  TOKENABLE_RWA_ADDRESS,
  USDC_ADDRESS,
  USDC_ABI,
} from "@/constants/contracts";
import {
  createOrder,
  getMerkleEligibleTokenIds,
  type Order,
} from "@/lib/api";
import { gasWithCap } from "@/lib/chainGas";
import { mapWalletError } from "@/lib/walletError";
import { assertMerkleRootBytes32, u256Hex32 } from "@/lib/seaport/eip712Uint";
import { SeaportMerkleTree } from "@/lib/seaport/merkle";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const ORDER_DURATION_SECONDS = 30 * 24 * 60 * 60;
const ITEM_ERC20 = 1;
const ITEM_CRITERIA721 = 4;

type Step = "idle" | "approving" | "signing" | "submitting" | "success" | "error";

export function CollectionCriteriaBidPanel({
  collectionKey,
  onPlaced,
  onOpenSellModal,
}: {
  collectionKey: string;
  onPlaced?: (order: Order) => void;
  /** When set (e.g. on collection page), opens modal to pick RWAs in this collection */
  onOpenSellModal?: () => void;
}) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { data: walletClient } = useWalletClient({ chainId: sepolia.id });
  const { writeContractAsync } = useWriteContract();
  const queryClient = useQueryClient();

  const [price, setPrice] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const { data: counter } = useReadContract({
    address: SEAPORT_ADDRESS,
    abi: SEAPORT_ABI,
    functionName: "getCounter",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!address },
  });

  const { data: usdcBalRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: { enabled: !!address },
  });

  const balanceUsdc = useMemo(() => {
    if (usdcBalRaw == null) return null;
    return Number(formatUnits(usdcBalRaw as bigint, 6));
  }, [usdcBalRaw]);

  const { data: merkleData, isLoading: merkleLoading } = useQuery({
    queryKey: ["merkle-set", collectionKey],
    queryFn: () => getMerkleEligibleTokenIds(collectionKey),
    enabled: !!collectionKey,
  });

  async function handleSubmit() {
    if (!address) {
      setErrorMsg("Connect your wallet.");
      return;
    }
    if (!publicClient) {
      setErrorMsg("Network client not ready. Refresh the page or switch to Sepolia.");
      return;
    }
    if (!walletClient) {
      setErrorMsg(
        "Wallet is not ready to sign. Unlock MetaMask (or your wallet), then try again."
      );
      return;
    }
    const n = parseFloat(price);
    if (!Number.isFinite(n) || n <= 0) {
      setErrorMsg("Enter a valid USDC price.");
      return;
    }
    if (counter === undefined) {
      setErrorMsg("Could not read Seaport counter.");
      return;
    }

    setErrorMsg("");

    let priceInUnits: bigint;
    try {
      priceInUnits = parseUnits(price, 6);
    } catch {
      setErrorMsg("Invalid USDC price format.");
      return;
    }

    let tokenIds: bigint[];
    try {
      tokenIds = (merkleData?.tokenIds ?? []).map((x) => BigInt(String(x).trim()));
    } catch {
      setErrorMsg("Invalid token IDs in the Merkle set from the server.");
      return;
    }
    if (tokenIds.length === 0) {
      setErrorMsg(
        "No token IDs in this collection’s Merkle set yet (need at least one active listing to anchor IDs). List an asset first."
      );
      return;
    }

    const now = BigInt(Math.floor(Date.now() / 1000));
    const endTime = now + BigInt(ORDER_DURATION_SECONDS);
    const salt = BigInt(Math.floor(Math.random() * 1_000_000_000_000));

    try {
      const tree = new SeaportMerkleTree(tokenIds);
      const rootHex = tree.getHexRoot();
      assertMerkleRootBytes32(rootHex);

      const allowance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "allowance",
        args: [address, SEAPORT_ADDRESS],
      });
      const needsUsdcApprove = allowance < priceInUnits;

      if (needsUsdcApprove) {
        setStep("approving");
        const gasApprove = await gasWithCap(publicClient, {
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "approve",
          args: [SEAPORT_ADDRESS, maxUint256],
          account: address,
        });
        const approveTx = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "approve",
          args: [SEAPORT_ADDRESS, maxUint256],
          chainId: sepolia.id,
          gas: gasApprove,
        });
        void publicClient.waitForTransactionReceipt({ hash: approveTx }).catch(() => {
          /* 백그라운드에서만 확인; 실패 시 매칭·풀필 단계에서 allowance 부족으로 드러남 */
        });
      }

      setStep("signing");
      const merkleRootU256 = hexToBigInt(rootHex);
      const orderMessage = {
        offerer: address,
        zone: ZERO_ADDRESS,
        offer: [
          {
            itemType: ITEM_ERC20,
            token: USDC_ADDRESS,
            identifierOrCriteria: u256Hex32(BigInt(0)),
            startAmount: u256Hex32(priceInUnits),
            endAmount: u256Hex32(priceInUnits),
          },
        ],
        consideration: [
          {
            itemType: ITEM_CRITERIA721,
            token: TOKENABLE_RWA_ADDRESS,
            identifierOrCriteria: u256Hex32(merkleRootU256),
            startAmount: u256Hex32(BigInt(1)),
            endAmount: u256Hex32(BigInt(1)),
            recipient: address,
          },
        ],
        orderType: 0,
        startTime: u256Hex32(now),
        endTime: u256Hex32(endTime),
        zoneHash: ZERO_BYTES32,
        salt: u256Hex32(salt),
        conduitKey: ZERO_BYTES32,
        counter: u256Hex32(counter as bigint),
      };

      const signature = await walletClient.signTypedData({
        domain: {
          name: "Seaport",
          version: "1.5",
          chainId: sepolia.id,
          verifyingContract: SEAPORT_ADDRESS,
        },
        types: SEAPORT_ORDER_TYPES,
        primaryType: "OrderComponents",
        message: orderMessage as never,
      });

      setStep("submitting");
      const str = (v: unknown): string => String(v);
      const order = await createOrder({
        side: "bid",
        collectionKey,
        parameters: {
          offerer: str(orderMessage.offerer),
          zone: str(ZERO_ADDRESS),
          zoneHash: ZERO_BYTES32,
          startTime: str(now),
          endTime: str(endTime),
          orderType: 0,
          offer: [
            {
              itemType: ITEM_ERC20,
              token: USDC_ADDRESS,
              identifierOrCriteria: "0",
              startAmount: str(priceInUnits),
              endAmount: str(priceInUnits),
            },
          ],
          consideration: [
            {
              itemType: ITEM_CRITERIA721,
              token: TOKENABLE_RWA_ADDRESS,
              identifierOrCriteria: rootHex,
              startAmount: "1",
              endAmount: "1",
              recipient: address,
            },
          ],
          totalOriginalConsiderationItems: 1,
          salt: str(salt),
          conduitKey: ZERO_BYTES32,
          counter: str(counter),
        },
        signature,
        tokenContract: TOKENABLE_RWA_ADDRESS,
        tokenId: "0",
        considerationToken: USDC_ADDRESS,
        considerationAmount: str(priceInUnits),
      });

      setStep("success");
      onPlaced?.(order);
      await queryClient.invalidateQueries({ queryKey: ["marketplace-collection", collectionKey] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
    } catch (e: unknown) {
      setErrorMsg(mapWalletError(e).message);
      setStep("error");
    }
  }

  const busy = step !== "idle" && step !== "success" && step !== "error";

  return (
    <div className="rounded-2xl border border-gray-800/90 bg-[#0b0e11] overflow-hidden shadow-[0_12px_32px_-16px_rgba(0,0,0,0.55)]">
      <div className="px-4 pt-4 pb-3 border-b border-gray-800/80">
        <h2 className="text-lg font-bold text-white tracking-tight">Collection bid</h2>
        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
          Max USDC you pay for <span className="text-gray-400">one</span> eligible RWA in this
          collection (Seaport criteria + Merkle root). Settlement when a seller listing matches.
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="flex justify-between text-[11px] text-gray-500">
          <span>Wallet USDC</span>
          <span className="font-mono text-gray-400 tabular-nums">
            {balanceUsdc != null
              ? `${balanceUsdc.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "—"}
          </span>
        </div>

        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-1">
            Max price (USDC)
          </label>
          <div className="flex rounded-lg border border-gray-800 bg-black/50 overflow-hidden focus-within:border-gray-700">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={price}
              disabled={busy || !address}
              onChange={(e) => setPrice(e.target.value)}
              className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-gray-600 font-mono tabular-nums"
            />
            <span className="shrink-0 px-3 py-2.5 text-[11px] font-semibold text-gray-500 border-l border-gray-800/90 bg-black/30">
              USDC
            </span>
          </div>
        </div>

        {merkleLoading ? (
          <p className="text-xs text-gray-500">Loading Merkle set…</p>
        ) : (
          <p className="text-[10px] text-gray-600 leading-relaxed">
            Merkle leaves:{" "}
            <span className="text-gray-400 font-mono">{merkleData?.tokenIds?.length ?? 0}</span>{" "}
            token ID(s). Needs at least one active listing in this collection to anchor IDs.
          </p>
        )}

        <button
          type="button"
          disabled={
            busy ||
            !address ||
            (isConnected && !walletClient) ||
            merkleData?.tokenIds?.length === 0 ||
            counter === undefined
          }
          onClick={() => void handleSubmit()}
          className="w-full rounded-xl py-3 text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          {!address
            ? "Connect wallet"
            : isConnected && !walletClient
              ? "Open wallet…"
              : counter === undefined
                ? "Loading…"
                : busy
                  ? step
                  : "Sign & place bid"}
        </button>

        {errorMsg && <p className="text-[11px] text-rose-400/90">{errorMsg}</p>}
        {step === "success" && (
          <p className="text-[11px] text-emerald-400/90">
            Bid saved. Sellers can match from their listing.
          </p>
        )}

        <div className="pt-2 border-t border-gray-800/80">
          <p className="text-[11px] text-gray-500 mb-2">
            Selling is per token: list a specific RWA from your wallet.
          </p>
          {onOpenSellModal ? (
            <button
              type="button"
              onClick={onOpenSellModal}
              className="w-full text-center rounded-lg py-2.5 text-sm font-semibold text-mint border border-mint/25 bg-mint/[0.06] hover:bg-mint/[0.1]"
            >
              List for sale in this collection
            </button>
          ) : (
            <Link
              href="/?tab=my-rwa"
              className="block text-center rounded-lg py-2.5 text-sm font-semibold text-mint border border-mint/25 bg-mint/[0.06] hover:bg-mint/[0.1]"
            >
              My Assets — list for sale
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
