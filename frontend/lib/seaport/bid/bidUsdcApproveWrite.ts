import type { SendTransactionModalUIOptions } from "@privy-io/react-auth";
import type { Address, Hash } from "viem";
import type { USDC_ABI } from "@/constants/contracts";
import type { UserTxFees } from "@/lib/network";
import type { PrivyAwareWriteContractInput } from "@/hooks/wallet/usePrivyAwareWriteContract";
import { bidUsdcSeaportApprovalPrivyUi } from "@/lib/privy/redeemTxUi";

export type UsdcSeaportApproveWrite = (args: {
  address: Address;
  abi: typeof USDC_ABI;
  functionName: "approve";
  args: readonly [Address, bigint];
  chainId: number;
  gas?: bigint;
} & UserTxFees) => Promise<Hash>;

/** @alias UsdcSeaportApproveWrite — bid + buy share the same write shape */
export type BidUsdcSeaportApproveWrite = UsdcSeaportApproveWrite;

export function buildUsdcSeaportApproveWrite(
  writeContractWithPrivyUi: (
    input: PrivyAwareWriteContractInput,
  ) => Promise<Hash>,
  privyUi: () => SendTransactionModalUIOptions,
): UsdcSeaportApproveWrite {
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
      privyUi: privyUi(),
    });
  };
}

export function buildBidUsdcSeaportApproveWrite(
  writeContractWithPrivyUi: (
    input: PrivyAwareWriteContractInput,
  ) => Promise<Hash>,
): BidUsdcSeaportApproveWrite {
  return buildUsdcSeaportApproveWrite(
    writeContractWithPrivyUi,
    bidUsdcSeaportApprovalPrivyUi,
  );
}
