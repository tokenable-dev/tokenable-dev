import type { Address } from "viem";
import type { TOKENABLE_RWA_APPROVE_ABI } from "@/constants/contracts";
import type { UserTxFees } from "@/lib/network";
import type { PrivyAwareWriteContractInput } from "@/hooks/wallet/usePrivyAwareWriteContract";
import { listSeaportApprovalPrivyUi } from "@/lib/privy/redeemTxUi";
import type { Hash } from "viem";

export type ListingSeaportApproveWrite = (args: {
  address: Address;
  abi: typeof TOKENABLE_RWA_APPROVE_ABI;
  functionName: "setApprovalForAll";
  args: readonly [Address, boolean];
  chainId: number;
  gas: bigint;
} & UserTxFees) => Promise<`0x${string}`>;

export function buildListingSeaportApproveWrite(
  writeContractWithPrivyUi: (
    input: PrivyAwareWriteContractInput,
  ) => Promise<Hash>,
): ListingSeaportApproveWrite {
  return async (args) => {
    const {
      address: contract,
      abi,
      functionName,
      args: fnArgs,
      chainId,
      gas,
      maxFeePerGas,
      maxPriorityFeePerGas,
    } = args;
    return writeContractWithPrivyUi({
      chainId,
      address: contract,
      abi,
      functionName,
      args: fnArgs,
      gas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      privyUi: listSeaportApprovalPrivyUi(),
    });
  };
}
