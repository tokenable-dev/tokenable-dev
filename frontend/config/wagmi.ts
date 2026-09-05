/** Active chain helpers — use `useAppChain()` in client components. */
export { useAppChain, CHAIN_ID_HEADER } from "@/providers/AppChainProvider";
export { useChainContracts } from "@/hooks/chain/useChainContracts";
export {
  DEFAULT_CHAIN_ID,
  getChainContracts,
  getChainDefinition,
  getConfiguredChains,
  type SupportedChainId,
  type AppChainDefinition,
} from "@/lib/chains";

/** @deprecated Use useAppChain().chain.viemChain */
export { privyDefaultChain as defaultChain } from "@/lib/privy/config";
