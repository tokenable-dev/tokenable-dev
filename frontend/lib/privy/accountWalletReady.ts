import { getAccount } from "wagmi/actions";
import type { ConnectedWallet } from "@privy-io/react-auth";
import { normalizeWalletAddress } from "@/lib/auth/wallets";
import { isEmbeddedOnlyWalletPolicy, wagmiPrivyConfig } from "@/lib/privy/config";
import {
  ensurePrivyWalletOnChain,
  isPrivyEmbeddedWallet,
  resolveAccountSigningWallet,
} from "@/lib/privy/wallet";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForWagmiAccountAddress(
  expectedAddress: string,
  timeoutMs = 8_000,
): Promise<void> {
  const want = normalizeWalletAddress(expectedAddress);
  if (!want) throw new Error("Invalid account wallet address");

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { address, isConnected } = getAccount(wagmiPrivyConfig);
    const got = normalizeWalletAddress(address);
    if (isConnected && got === want) return;
    await sleep(120);
  }

  throw new Error("Account wallet session is not ready. Please wait a moment and try again.");
}

/** Activate the Tokenable account wallet in wagmi before signing or minting. */
export async function alignWagmiToAccountWallet(input: {
  wallets: ConnectedWallet[];
  accountPrimary?: string;
  setActiveWallet: (wallet: ConnectedWallet) => Promise<void>;
  /** When set, also switches the Privy wallet onto this chain (approve/sign UIs). */
  chainId?: number;
}): Promise<string> {
  const target = resolveAccountSigningWallet(input.wallets, input.accountPrimary);
  if (!target) {
    throw new Error("Account wallet not found in Privy session.");
  }

  if (isEmbeddedOnlyWalletPolicy() && !isPrivyEmbeddedWallet(target)) {
    throw new Error("External wallets are disabled. Use your Privy account wallet.");
  }

  const targetNorm = normalizeWalletAddress(target.address);
  const connected = normalizeWalletAddress(getAccount(wagmiPrivyConfig).address);

  if (connected !== targetNorm) {
    await input.setActiveWallet(target);
    await waitForWagmiAccountAddress(target.address);
  }

  if (input.chainId != null) {
    await ensurePrivyWalletOnChain(target, input.chainId);
  }

  return target.address;
}
