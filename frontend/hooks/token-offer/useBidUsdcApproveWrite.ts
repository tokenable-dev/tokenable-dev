"use client";

import { useCallback } from "react";
import { usePrivyAwareWriteContract } from "@/hooks/wallet/usePrivyAwareWriteContract";
import {
  buildBidUsdcSeaportApproveWrite,
  type BidUsdcSeaportApproveWrite,
} from "@/lib/seaport/bid/bidUsdcApproveWrite";

export function useBidUsdcApproveWrite(): BidUsdcSeaportApproveWrite {
  const { writeContractWithPrivyUi } = usePrivyAwareWriteContract();
  return useCallback(
    buildBidUsdcSeaportApproveWrite(writeContractWithPrivyUi),
    [writeContractWithPrivyUi],
  );
}
