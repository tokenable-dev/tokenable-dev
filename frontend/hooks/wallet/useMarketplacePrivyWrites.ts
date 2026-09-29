"use client";

import { useCallback, useMemo } from "react";
import { usePrivyAwareWriteContract } from "@/hooks/wallet/usePrivyAwareWriteContract";
import type { PrivyAwareWriteContractInput } from "@/hooks/wallet/usePrivyAwareWriteContract";
import {
  buildBidUsdcSeaportApproveWrite,
  type BidUsdcSeaportApproveWrite,
} from "@/lib/seaport/bid/bidUsdcApproveWrite";
import {
  buildBuyAskWrites,
  type BuyAskWrites,
} from "@/lib/seaport/fulfillment/fulfillAskListing";
import {
  buildListingSeaportApproveWrite,
  type ListingSeaportApproveWrite,
} from "@/lib/seaport/listing/listingSeaportApproveWrite";
import type { MatchWriteContractAsync } from "@/lib/seaport/fulfillment/runCriteriaMatch";
import { sellSeaportMatchPrivyUi } from "@/lib/privy/redeemTxUi";

function buildSeaportMatchWrite(
  writeContractWithPrivyUi: (
    input: PrivyAwareWriteContractInput,
  ) => Promise<`0x${string}`>,
): MatchWriteContractAsync {
  return async (args) => {
    const {
      address,
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
      address,
      abi,
      functionName,
      args: fnArgs,
      gas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      privyUi: sellSeaportMatchPrivyUi(),
    });
  };
}

/** Privy-aware on-chain writes for list, bid, buy, and sell-into-bid match flows. */
export function useMarketplacePrivyWrites(): {
  listingSeaportApprove: ListingSeaportApproveWrite;
  bidUsdcApprove: BidUsdcSeaportApproveWrite;
  buyAsk: BuyAskWrites;
  seaportMatch: MatchWriteContractAsync;
} {
  const { writeContractWithPrivyUi } = usePrivyAwareWriteContract();
  const listingSeaportApprove = useCallback(
    buildListingSeaportApproveWrite(writeContractWithPrivyUi),
    [writeContractWithPrivyUi],
  );
  const bidUsdcApprove = useCallback(
    buildBidUsdcSeaportApproveWrite(writeContractWithPrivyUi),
    [writeContractWithPrivyUi],
  );
  const buyAsk = useMemo(
    () => buildBuyAskWrites(writeContractWithPrivyUi),
    [writeContractWithPrivyUi],
  );
  const seaportMatch = useCallback(
    buildSeaportMatchWrite(writeContractWithPrivyUi),
    [writeContractWithPrivyUi],
  );
  return { listingSeaportApprove, bidUsdcApprove, buyAsk, seaportMatch };
}
