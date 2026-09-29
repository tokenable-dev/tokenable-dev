"use client";

import { useCallback } from "react";
import { usePrivyAwareWriteContract } from "@/hooks/wallet/usePrivyAwareWriteContract";
import {
  buildListingSeaportApproveWrite,
  type ListingSeaportApproveWrite,
} from "@/lib/seaport/listing/listingSeaportApproveWrite";

export function useListingSeaportApproveWrite(): ListingSeaportApproveWrite {
  const { writeContractWithPrivyUi } = usePrivyAwareWriteContract();
  return useCallback(
    buildListingSeaportApproveWrite(writeContractWithPrivyUi),
    [writeContractWithPrivyUi],
  );
}
