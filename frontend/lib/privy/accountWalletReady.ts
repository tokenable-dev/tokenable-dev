import { getAccount } from "wagmi/actions";
import type { ConnectedWallet } from "@privy-io/react-auth";
import { normalizeWalletAddress } from "@/lib/auth/wallets";
import { isEmbeddedOnlyWalletPolicy, wagmiPrivyConfig } from "@/lib/privy/config";
import {
  ensurePrivyWalletOnChain,
  findPrivyWalletByAddress,
  isPrivyEmbeddedWallet,
  parsePrivyWalletChainId,
  resolveAccountSigningWallet,
} from "@/lib/privy/wallet";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type WaitForConditionOptions = {
  timeoutMs: number;
  intervalMs?: number;
  /** Wall-clock while `document.hidden` does not count toward timeout (mobile return). */
  pauseWhileHidden?: boolean;
  /** Return true to abort early (component unmount / superseded attempt). */
  shouldCancel?: () => boolean;
};

/**
 * State-based wait — not a blind sleep. Distinguishes timeout from cancellation.
 * Returns true when `check` succeeds; false on timeout or cancel.
 */
export async function waitForCondition(
  check: () => boolean | Promise<boolean>,
  options: WaitForConditionOptions,
): Promise<boolean> {
  const intervalMs = options.intervalMs ?? 150;
  let remaining = options.timeoutMs;
  const pauseWhileHidden = options.pauseWhileHidden ?? false;

  while (remaining > 0) {
    if (options.shouldCancel?.()) return false;
    if (await check()) return true;

    const hidden =
      pauseWhileHidden &&
      typeof document !== "undefined" &&
      document.visibilityState === "hidden";

    const slice = Math.min(intervalMs, remaining);
    await sleep(slice);
    if (!hidden) remaining -= slice;
  }

  if (options.shouldCancel?.()) return false;
  return Boolean(await check());
}

export async function waitForPrivyWalletByAddress(
  readWallets: () => ConnectedWallet[],
  address: string,
  options?: WaitForConditionOptions,
): Promise<ConnectedWallet | undefined> {
  const want = normalizeWalletAddress(address);
  if (!want) return undefined;

  const found = () => findPrivyWalletByAddress(readWallets(), want);
  const immediate = found();
  if (immediate) return immediate;

  const ok = await waitForCondition(() => Boolean(found()), {
    timeoutMs: options?.timeoutMs ?? 90_000,
    intervalMs: options?.intervalMs ?? 200,
    pauseWhileHidden: options?.pauseWhileHidden ?? true,
    shouldCancel: options?.shouldCancel,
  });
  return ok ? found() : found();
}

/** Wait until any Privy session wallet appears (first-time link). */
export async function waitForAnyPrivyWallet(
  readWallets: () => ConnectedWallet[],
  options?: WaitForConditionOptions & { minCount?: number },
): Promise<ConnectedWallet | undefined> {
  const minCount = options?.minCount ?? 1;
  const pick = () => {
    const list = readWallets();
    return list.length >= minCount ? list[0] : undefined;
  };
  const immediate = pick();
  if (immediate) return immediate;

  const ok = await waitForCondition(() => Boolean(pick()), {
    timeoutMs: options?.timeoutMs ?? 90_000,
    intervalMs: options?.intervalMs ?? 200,
    pauseWhileHidden: options?.pauseWhileHidden ?? true,
    shouldCancel: options?.shouldCancel,
  });
  return ok ? pick() : pick();
}

export async function waitForWagmiAccountAddress(
  expectedAddress: string,
  timeoutMs = 12_000,
  shouldCancel?: () => boolean,
): Promise<void> {
  const want = normalizeWalletAddress(expectedAddress);
  if (!want) throw new Error("Invalid account wallet address");

  const ok = await waitForCondition(
    () => {
      const { address, isConnected } = getAccount(wagmiPrivyConfig);
      const got = normalizeWalletAddress(address);
      return Boolean(isConnected && got === want);
    },
    {
      timeoutMs,
      intervalMs: 80,
      pauseWhileHidden: true,
      shouldCancel,
    },
  );

  if (!ok) {
    if (shouldCancel?.()) return;
    throw new Error(
      "Account wallet session is not ready. Please wait a moment and try again.",
    );
  }
}

export async function waitForWagmiChainId(
  chainId: number,
  timeoutMs = 12_000,
  shouldCancel?: () => boolean,
): Promise<void> {
  const ok = await waitForCondition(
    () => getAccount(wagmiPrivyConfig).chainId === chainId,
    {
      timeoutMs,
      intervalMs: 100,
      pauseWhileHidden: true,
      shouldCancel,
    },
  );
  if (!ok) {
    if (shouldCancel?.()) return;
    throw new Error(
      `Wrong network. Switch your wallet to chain ${chainId} and try again.`,
    );
  }
}

/** Serialize concurrent align calls (trade + background active can race). */
let alignInFlight: Promise<string> | null = null;

/** Activate the Tokenable account wallet in wagmi before signing or minting. */
export async function alignWagmiToAccountWallet(input: {
  wallets: ConnectedWallet[];
  accountPrimary?: string;
  setActiveWallet: (wallet: ConnectedWallet) => Promise<void>;
  /** When set, also switches the Privy wallet onto this chain (approve/sign UIs). */
  chainId?: number;
}): Promise<string> {
  if (alignInFlight) return alignInFlight;

  alignInFlight = (async () => {
    const target = resolveAccountSigningWallet(input.wallets, input.accountPrimary);
    if (!target) {
      throw new Error(
        "Account wallet not found in Privy session. Reconnect your wallet and try again.",
      );
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
      await waitForWagmiChainId(input.chainId);

      const wagmiChain = getAccount(wagmiPrivyConfig).chainId;
      if (wagmiChain !== input.chainId) {
        throw new Error(
          `Wrong network. Switch your wallet to chain ${input.chainId} and try again.`,
        );
      }

      const privyChain = parsePrivyWalletChainId(target);
      // Prefer wagmi confirmation; Privy ConnectedWallet.chainId can lag after switch.
      if (privyChain != null && privyChain !== input.chainId) {
        // Re-check wagmi once more before treating as mismatch.
        if (getAccount(wagmiPrivyConfig).chainId !== input.chainId) {
          throw new Error(
            `Wrong network. Switch your wallet to chain ${input.chainId} and try again.`,
          );
        }
      }
    }

    return target.address;
  })().finally(() => {
    alignInFlight = null;
  });

  return alignInFlight;
}
