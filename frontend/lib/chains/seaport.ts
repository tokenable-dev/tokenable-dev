import { SEAPORT_ADDRESS, SEAPORT_ORDER_TYPES } from "@/constants/contracts";
import type { SupportedChainId } from "./types";

export function getSeaportOrderDomain(chainId: SupportedChainId) {
  return {
    name: "Seaport",
    version: "1.5",
    chainId,
    verifyingContract: SEAPORT_ADDRESS,
  } as const;
}

export { SEAPORT_ORDER_TYPES };
