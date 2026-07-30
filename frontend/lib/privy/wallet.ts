import type { ConnectedWallet, User as PrivyUser } from "@privy-io/react-auth";
import { normalizeWalletAddress } from "@/lib/auth/wallets";
import { isEmbeddedOnlyWalletPolicy } from "@/lib/privy/config";

function isPrivyLinkedEthereumWallet(
  account: PrivyUser["linkedAccounts"][number],
): account is Extract<PrivyUser["linkedAccounts"][number], { type: "wallet" }> {
  return account.type === "wallet" && account.chainType === "ethereum";
}

/** Wallet address from Privy user profile — available before `useWallets()` populates. */
export function pickPrivyUserEthereumWalletAddress(
  privyUser: PrivyUser | null | undefined,
): string | undefined {
  if (!privyUser) return undefined;

  const root = privyUser.wallet;
  if (root?.chainType === "ethereum") {
    const normalized = normalizeWalletAddress(root.address);
    if (normalized) return normalized;
  }

  const linked = privyUser.linkedAccounts?.filter(isPrivyLinkedEthereumWallet) ?? [];
  const embedded = linked.find(
    (w) => w.walletClientType === "privy" || w.connectorType === "embedded",
  );
  return normalizeWalletAddress((embedded ?? linked[0])?.address);
}

export function findPrivyWalletByAddress(
  wallets: ConnectedWallet[],
  address: string,
): ConnectedWallet | undefined {
  const needle = address.toLowerCase();
  return wallets.find((w) => w.address.toLowerCase() === needle);
}

export function isPrivyEmbeddedWallet(
  wallet: ConnectedWallet | undefined,
): boolean {
  if (!wallet) return false;
  if (wallet.walletClientType === "privy") return true;
  return String(wallet.connectorType ?? "").toLowerCase() === "embedded";
}

export function isPrivyExternalWallet(
  wallet: ConnectedWallet | undefined,
): boolean {
  if (!wallet) return false;
  return !isPrivyEmbeddedWallet(wallet);
}

/** Privy reports `eip155:137` (CAIP-2); some connectors use hex or decimal. */
export function parsePrivyWalletChainId(
  wallet: ConnectedWallet | undefined,
): number | null {
  if (!wallet?.chainId) return null;
  const raw = String(wallet.chainId).trim();
  if (!raw) return null;
  if (raw.startsWith("eip155:")) {
    const n = Number(raw.slice("eip155:".length));
    return Number.isFinite(n) ? n : null;
  }
  if (raw.startsWith("0x") || raw.startsWith("0X")) {
    const n = Number.parseInt(raw, 16);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Align Privy's ConnectedWallet active chain with the app selection.
 * EIP-1193 `wallet_switchEthereumChain` alone is not enough for embedded wallets —
 * Privy tx UIs (approve / send) read `wallet.chainId` until `switchChain` runs.
 */
export async function ensurePrivyWalletOnChain(
  wallet: ConnectedWallet,
  chainId: number,
): Promise<void> {
  if (parsePrivyWalletChainId(wallet) === chainId) return;
  await wallet.switchChain(chainId);
}

/**
 * Pre-sync guess for the account wallet — embedded only.
 *
 * `useWallets()` also lists browser extensions that this tab happens to have a
 * live connection to (MetaMask keeps its `eth_accounts` grant per origin). Such
 * a wallet is NOT the account wallet, and falling back to it would activate —
 * and therefore prompt — MetaMask for a Google/email login user.
 */
export function pickPrimaryPrivyWallet(
  wallets: ConnectedWallet[],
): ConnectedWallet | undefined {
  return wallets.find((w) => isPrivyEmbeddedWallet(w));
}

/**
 * Align wagmi's active wallet with the Tokenable account primary when that
 * wallet is present in the Privy session. Embedded-only policy never picks
 * an external / browser-extension wallet.
 */
export function resolveActivePrivyWallet(
  wallets: ConnectedWallet[],
  accountPrimaryLinked?: string,
): ConnectedWallet | undefined {
  if (accountPrimaryLinked) {
    const match = findPrivyWalletByAddress(wallets, accountPrimaryLinked);
    if (match) {
      if (isEmbeddedOnlyWalletPolicy() && !isPrivyEmbeddedWallet(match)) {
        const embedded = wallets.find((w) => isPrivyEmbeddedWallet(w));
        return embedded ?? match;
      }
      return match;
    }
  }
  if (isEmbeddedOnlyWalletPolicy()) {
    return wallets.find((w) => isPrivyEmbeddedWallet(w));
  }
  // No account primary yet — wait for backend session sync; do not guess embedded.
  return undefined;
}

/** Wallet used for signing / txs — respects embedded-only policy and account primary. */
export function resolveAccountSigningWallet(
  wallets: ConnectedWallet[],
  accountPrimary?: string,
): ConnectedWallet | undefined {
  const primary = accountPrimary?.trim();
  const target = resolveActivePrivyWallet(wallets, primary);
  if (!target) return undefined;

  if (isEmbeddedOnlyWalletPolicy() && !isPrivyEmbeddedWallet(target)) {
    return wallets.find((w) => isPrivyEmbeddedWallet(w));
  }

  if (primary) {
    const match = findPrivyWalletByAddress(wallets, primary);
    if (match && (!isEmbeddedOnlyWalletPolicy() || isPrivyEmbeddedWallet(match))) {
      return match;
    }
  }

  return target;
}

/**
 * Embedded → Privy SDK. External only when wallet login is explicitly enabled.
 */
export function shouldUsePrivySdkForSigning(opts: {
  privyEnabled: boolean;
  activeWallet: ConnectedWallet | undefined;
  accountPrimaryAddress?: string;
  connectorId: string | undefined;
  connectorName: string | undefined;
}): boolean {
  if (!opts.privyEnabled) return false;

  if (isEmbeddedOnlyWalletPolicy()) {
    if (opts.activeWallet && isPrivyEmbeddedWallet(opts.activeWallet)) return true;
    if (opts.accountPrimaryAddress) return true;
    return false;
  }

  if (opts.activeWallet && isPrivyExternalWallet(opts.activeWallet)) {
    return false;
  }

  if (opts.activeWallet && isPrivyEmbeddedWallet(opts.activeWallet)) {
    return true;
  }

  const connectorKey = `${opts.connectorId ?? ""} ${opts.connectorName ?? ""}`.toLowerCase();
  if (
    connectorKey.includes("metamask") ||
    connectorKey.includes("injected") ||
    connectorKey.includes("walletconnect") ||
    connectorKey.includes("coinbase")
  ) {
    return false;
  }

  if (connectorKey.includes("privy") || connectorKey.includes("embedded")) {
    return true;
  }

  return true;
}
