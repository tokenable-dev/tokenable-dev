import type { Abi, PublicClient, Address } from "viem";
import { sepolia } from "@/config/wagmi";
import { SEAPORT_ADDRESS, SEAPORT_ABI_WITH_MATCH_ADVANCED } from "@/constants/contracts";
import { fulfillMatchedPairApi, getMerkleEligibleTokenIds, type Order } from "@/lib/api";
import { buildCriteriaMatchExecution, isCriteriaCollectionBid } from "@/lib/seaport/criteriaMatch";
import { matchAdvancedOrdersArgs } from "@/lib/seaport/matchAdvancedOrdersArgs";
import { SeaportMerkleTree } from "@/lib/seaport/merkle";
import { GAS_FALLBACK, gasWithCapFast } from "@/lib/chainGas";
import { normalizeDecimalTokenId } from "@/lib/normalizeTokenId";
import { mapWalletError } from "@/lib/walletError";

function normRootHex(s: string): string {
  const t = String(s).trim().toLowerCase();
  if (t.startsWith("0x")) return t;
  if (/^[0-9a-f]{64}$/i.test(t)) return `0x${t}`;
  return t;
}

export type MatchWriteContractAsync = (args: {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  chainId: number;
  gas: bigint;
}) => Promise<`0x${string}`>;

export async function runCriteriaMatch(params: {
  address: Address;
  publicClient: PublicClient;
  writeContractAsync: MatchWriteContractAsync;
  bid: Order;
  listing: Order;
  tokenId: string | number;
  collectionKey: string;
}): Promise<void> {
  const { address, publicClient, writeContractAsync, bid, listing, tokenId, collectionKey } =
    params;

  if (!isCriteriaCollectionBid(bid)) {
    throw new Error("Not a criteria collection bid");
  }

  const tidBn = BigInt(normalizeDecimalTokenId(tokenId));

  const { tokenIds } = await getMerkleEligibleTokenIds(collectionKey);
  const ids = tokenIds.map((x) => BigInt(normalizeDecimalTokenId(x)));
  if (ids.length === 0) {
    throw new Error("Merkle set is empty.");
  }
  if (!ids.some((id) => id === tidBn)) {
    throw new Error("This token ID is not in the current Merkle leaf set.");
  }

  const tree = new SeaportMerkleTree(ids);
  const currentRoot = tree.getHexRoot();
  const bidRoot = bid.parameters?.consideration?.[0]?.identifierOrCriteria;
  if (!bidRoot) {
    throw new Error("Invalid bid: missing Merkle root.");
  }
  if (normRootHex(String(bidRoot)) !== normRootHex(currentRoot)) {
    throw new Error(
      "This bid’s Merkle root does not match the current listing set. The buyer should cancel and place a new collection bid."
    );
  }

  const proof = tree.getCriteriaProof(tidBn);

  const exec = buildCriteriaMatchExecution({
    criteriaBidOrder: bid,
    listingOrder: listing,
    tokenId: tidBn,
    criteriaProof: proof,
  });
  const prepared = matchAdvancedOrdersArgs({
    orders: exec.orders,
    criteriaResolvers: exec.criteriaResolvers,
    fulfillments: exec.fulfillments,
    recipient: exec.recipient,
  });

  const gasPromise = gasWithCapFast(
    publicClient,
    {
      address: SEAPORT_ADDRESS,
      abi: prepared.abi,
      functionName: prepared.functionName,
      args: prepared.args,
      account: address,
    },
    GAS_FALLBACK.matchAdvancedOrders,
  );

  await publicClient.simulateContract({
    address: SEAPORT_ADDRESS,
    abi: SEAPORT_ABI_WITH_MATCH_ADVANCED,
    functionName: "matchAdvancedOrders",
    args: prepared.args as readonly [unknown, unknown, unknown, unknown],
    account: address,
  });

  const gas = await gasPromise;

  const hash = await writeContractAsync({
    address: SEAPORT_ADDRESS,
    abi: prepared.abi as Abi,
    functionName: prepared.functionName,
    args: prepared.args as readonly unknown[],
    chainId: sepolia.id,
    gas,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error(
      `Seaport match reverted on-chain (tx ${hash}). Simulation may differ from execution; check the buyer’s USDC balance and approval to Seaport.`,
    );
  }

  await fulfillMatchedPairApi({
    bidOrderHash: bid.orderHash,
    askOrderHash: listing.orderHash,
  });
}

const GENERIC_CONTRACT =
  "The contract could not complete this action. Check balances, approvals, and listing status.";

export function mapMatchError(e: unknown): string {
  const { message, code } = mapWalletError(e);
  if (code !== "REVERT") return message;

  const low = message.toLowerCase();
  if (
    low.includes("allowance") ||
    low.includes("erc20") ||
    (low.includes("transfer") &&
      (low.includes("fail") || low.includes("exceed") || low.includes("insufficient")))
  ) {
    return `${message} You’re selling: Seaport still pulls USDC from the buyer’s wallet. They need enough USDC and an allowance to Seaport (the same approval used when placing the collection bid).`;
  }

  if (message === GENERIC_CONTRACT) {
    return `${message} For instant match: confirm the buyer still has USDC + Seaport approval, your NFT is approved for Seaport, listing/bid are active, and Merkle set matches.`;
  }

  return message;
}
