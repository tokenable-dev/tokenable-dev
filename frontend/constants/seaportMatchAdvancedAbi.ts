import type { Abi } from "viem";
import raw from "./seaportMatchAdvancedAbi.json";

/** Single-function ABI: `matchAdvancedOrders` (Seaport 1.5, from OpenSea `seaport-js` / official contract). */
export const SEAPORT_MATCH_ADVANCED_ORDERS_ABI = raw as Abi;
