import type { Abi, PublicClient, Address } from "viem";
import { sepolia } from "@/config/wagmi";
import { SEAPORT_ADDRESS, SEAPORT_ABI_WITH_MATCH_ADVANCED } from "@/constants/contracts";
import { fulfillMatchedPairApi, getMerkleEligibleTokenIds, type Order } from "@/lib/api";
import { buildCriteriaMatchExecution, isCriteriaCollectionBid } from "@/lib/seaport/criteriaMatch";
import { matchAdvancedOrdersArgs } from "@/lib/seaport/matchAdvancedOrdersArgs";
import { SeaportMerkleTree } from "@/lib/seaport/merkle";
import { gasWithCap } from "@/lib/chainGas";
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
  tokenId: number;
  collectionKey: string;
}): Promise<void> {
  const { address, publicClient, writeContractAsync, bid, listing, tokenId, collectionKey } =
    params;

  if (!isCriteriaCollectionBid(bid)) {
    throw new Error("Not a criteria collection bid");
  }

  const { tokenIds } = await getMerkleEligibleTokenIds(collectionKey);
  const ids = tokenIds.map((x) => BigInt(x));
  if (ids.length === 0) {
    throw new Error("Merkle set is empty.");
  }
  if (!ids.some((id) => id === BigInt(tokenId))) {
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

  const proof = tree.getCriteriaProof(BigInt(tokenId));

  const exec = buildCriteriaMatchExecution({
    criteriaBidOrder: bid,
    listingOrder: listing,
    tokenId: BigInt(tokenId),
    criteriaProof: proof,
  });
  const prepared = matchAdvancedOrdersArgs({
    orders: exec.orders,
    criteriaResolvers: exec.criteriaResolvers,
    fulfillments: exec.fulfillments,
    recipient: exec.recipient,
  });

  await publicClient.simulateContract({
    address: SEAPORT_ADDRESS,
    abi: SEAPORT_ABI_WITH_MATCH_ADVANCED,
    functionName: "matchAdvancedOrders",
    args: prepared.args as readonly [unknown, unknown, unknown, unknown],
    account: address,
  });

  const gas = await gasWithCap(publicClient, {
    address: SEAPORT_ADDRESS,
    abi: prepared.abi,
    functionName: prepared.functionName,
    args: prepared.args,
    account: address,
  });

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
    throw new Error("Seaport matchAdvancedOrders reverted.");
  }

  await fulfillMatchedPairApi({
    bidOrderHash: bid.orderHash,
    askOrderHash: listing.orderHash,
  });
}

export function mapMatchError(e: unknown): string {
  return mapWalletError(e).message;
}
