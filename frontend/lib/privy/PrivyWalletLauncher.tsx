"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import type { ConnectedWallet } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import {
  findPrivyWalletByAddress,
  isPrivyExternalWallet,
  resolveActivePrivyWallet,
} from "@/lib/privy/wallet";
import {
  waitForAnyPrivyWallet,
  waitForPrivyWalletByAddress,
  waitForWagmiAccountAddress,
} from "@/lib/privy/accountWalletReady";
import {
  getPrimaryWalletAddress,
  normalizeWalletAddress,
} from "@/lib/auth/wallets";
import {
  mapWalletConnectError,
  type WalletConnectErrorCode,
} from "@/lib/network/walletError";
import { refreshPrivyAuthSession } from "@/lib/privy/session";
import { resolvePrivyExternalWalletList } from "@/lib/privy/config";
import { isMobileBrowserUa } from "@/lib/privy/walletLoginIntent";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";
import { useToastStore } from "@/store/toastStore";

const QUICK_SESSION_WAIT_MS = 2_500;
const MOBILE_RETURN_WAIT_MS = 120_000;

const CONNECT_ERROR_COPY: Record<WalletConnectErrorCode, string> = {
  USER_CANCELLED: "Wallet connection was cancelled. Try again when you are ready.",
  ACTIVATION_FAILED: "Could not activate your wallet. Please try connecting again.",
  WALLET_UNAVAILABLE:
    "Wallet is not available in this browser session. Open MetaMask and try connecting again.",
  ACCOUNT_MISMATCH:
    "The wallet in MetaMask does not match your Tokenable account wallet. Switch accounts or reconnect.",
  CHAIN_MISMATCH: "Wrong network in your wallet. Switch to the app network and try again.",
  TIMEOUT: "We couldn't finish connecting your wallet. Please try connecting again.",
  UNKNOWN: "Something went wrong connecting your wallet. Please try again.",
};

function pushConnectToast(title: string, message: string) {
  useToastStore.getState().push({
    tone: "warning",
    title,
    message,
    durationMs: 8_000,
  });
}

/**
 * Activates or links the account wallet via Privy when auth UI requests it.
 *
 * Flow:
 * 1. Primary already in Privy session → setActiveWallet + wagmi reconcile
 * 2. Primary linked but missing from this browser → Privy `connectWallet` (reconnect)
 * 3. No primary yet → Privy `linkWallet`
 *
 * Mobile return: phase lives in `authUiStore` so remounts resume reconciliation
 * instead of opening a second Privy modal.
 */
export function PrivyWalletLauncher() {
  const router = useRouter();
  const connectWalletOpen = useAuthUiStore((s) => s.connectWalletOpen);
  const closeConnectWallet = useAuthUiStore((s) => s.closeConnectWallet);
  const consumeReturnTo = useAuthUiStore((s) => s.consumeReturnTo);
  const beginWalletActivation = useAuthUiStore((s) => s.beginWalletActivation);
  const setWalletActivationPhase = useAuthUiStore((s) => s.setWalletActivationPhase);
  const failWalletActivation = useAuthUiStore((s) => s.failWalletActivation);
  const finishWalletActivation = useAuthUiStore((s) => s.finishWalletActivation);
  const openWalletMismatch = useAuthUiStore((s) => s.openWalletMismatch);
  const phase = useAuthUiStore((s) => s.walletActivationPhase);
  const expectedAddress = useAuthUiStore((s) => s.walletActivationExpectedAddress);

  const user = useAuthStore((s) => s.user);
  const hydrateFromSession = useAuthStore((s) => s.hydrateFromSession);
  const { ready, authenticated, getAccessToken, linkWallet, connectWallet } =
    usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();

  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const navigateAfterSuccess = () => {
    const returnTo = consumeReturnTo();
    if (returnTo) router.push(returnTo);
  };

  const reportFailure = (
    err: unknown,
    fallbackCode: WalletConnectErrorCode = "UNKNOWN",
  ) => {
    const mapped = mapWalletConnectError(err);
    const code = mapped.code === "UNKNOWN" ? fallbackCode : mapped.code;
    const userMessage = CONNECT_ERROR_COPY[code] ?? mapped.message;

    failWalletActivation(code, userMessage);

    if (code === "USER_CANCELLED") {
      trackEvent("wallet_connect_cancelled", { error_code: code });
      pushConnectToast("Connection cancelled", userMessage);
      return;
    }
    if (code === "TIMEOUT") {
      trackEvent("wallet_connect_timeout", { error_code: code });
    } else if (code === "ACCOUNT_MISMATCH") {
      trackEvent("wallet_account_mismatch", { error_code: code });
    } else if (code === "CHAIN_MISMATCH") {
      trackEvent("wallet_chain_mismatch", { error_code: code });
    } else {
      trackEvent("wallet_connect_failed", {
        error_code: code,
        error_message: userMessage.slice(0, 120),
      });
    }
    pushConnectToast("Wallet connection", userMessage);
  };

  const reconcileActiveWallet = async (wallet: ConnectedWallet) => {
    await setActiveWallet(wallet);
    await waitForWagmiAccountAddress(
      wallet.address,
      12_000,
      () => cancelledRef.current,
    );
  };

  // Step 1 — start a single activation when UI requests connect.
  useEffect(() => {
    if (!connectWalletOpen || !ready || !authenticated) return;

    const primaryLinked = getPrimaryWalletAddress(user);
    const started = beginWalletActivation(primaryLinked);
    closeConnectWallet();
    if (!started) return;

    trackEvent("wallet_connect_started");

    void (async () => {
      try {
        let primary = primaryLinked;

        // Social / Privy lag: wallets exist locally but backend primary not hydrated yet.
        if (!primary && walletsRef.current.length > 0) {
          const synced = await refreshPrivyAuthSession(getAccessToken);
          if (synced) {
            await hydrateFromSession(synced);
            primary = getPrimaryWalletAddress(synced);
            if (primary) {
              useAuthUiStore.setState({
                walletActivationExpectedAddress: primary.toLowerCase(),
              });
            }
          }
        }

        if (cancelledRef.current) return;

        if (primary) {
          const quick =
            findPrivyWalletByAddress(walletsRef.current, primary) ??
            (await waitForPrivyWalletByAddress(
              () => walletsRef.current,
              primary,
              {
                timeoutMs: QUICK_SESSION_WAIT_MS,
                pauseWhileHidden: false,
                shouldCancel: () => cancelledRef.current,
              },
            ));

          if (quick) {
            // Desktop extensions can sit in useWallets() via eth_accounts without
            // a user gesture — always re-open Privy connect there.
            // Mobile WC sessions from MetaMask login are real; a second connectWallet
            // deeplink hangs on "Waiting for MetaMask" on iOS Safari.
            if (isPrivyExternalWallet(quick)) {
              if (isMobileBrowserUa()) {
                try {
                  await reconcileActiveWallet(quick);
                  if (cancelledRef.current) return;
                  finishWalletActivation();
                  trackEvent("wallet_connected", { provider: "session_mobile" });
                  navigateAfterSuccess();
                  return;
                } catch {
                  // Fall through to an explicit Privy connect.
                }
              }
              setWalletActivationPhase("waiting_mobile_return");
              connectWallet({
                description: "Reconnect your account wallet to continue",
                walletList: resolvePrivyExternalWalletList(),
              });
              return;
            }
            await reconcileActiveWallet(quick);
            if (cancelledRef.current) return;
            finishWalletActivation();
            trackEvent("wallet_connected", { provider: "session" });
            navigateAfterSuccess();
            return;
          }

          // Primary linked but not in this browser session — reconnect via Privy.
          setWalletActivationPhase("waiting_mobile_return");
          connectWallet({
            description: "Reconnect your account wallet to continue",
            walletList: resolvePrivyExternalWalletList(),
          });
          return;
        }

        // No Tokenable primary yet — link through Privy (not connect-only).
        setWalletActivationPhase("waiting_mobile_return");
        linkWallet({
          description: "Link a wallet to your Tokenable account",
          walletList: resolvePrivyExternalWalletList(),
        });
      } catch (err) {
        reportFailure(err, "ACTIVATION_FAILED");
      }
    })();
    // Start once per openConnectWallet pulse.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start gate only
  }, [connectWalletOpen, ready, authenticated]);

  // Step 2 — wait for mobile return / Privy session, then reconcile wagmi.
  useEffect(() => {
    if (phase !== "waiting_mobile_return" && phase !== "reconciling") return;
    if (!ready || !authenticated) return;

    let cancelled = false;
    const shouldCancel = () => cancelled || cancelledRef.current;

    void (async () => {
      try {
        const expected =
          expectedAddress ??
          normalizeWalletAddress(getPrimaryWalletAddress(user));

        let wallet: ConnectedWallet | undefined;

        if (phase === "waiting_mobile_return") {
          if (expected) {
            wallet = await waitForPrivyWalletByAddress(
              () => walletsRef.current,
              expected,
              {
                timeoutMs: MOBILE_RETURN_WAIT_MS,
                pauseWhileHidden: true,
                shouldCancel,
              },
            );
          } else {
            wallet = await waitForAnyPrivyWallet(() => walletsRef.current, {
              timeoutMs: MOBILE_RETURN_WAIT_MS,
              pauseWhileHidden: true,
              shouldCancel,
            });
          }

          if (shouldCancel()) return;

          if (!wallet) {
            const synced = await refreshPrivyAuthSession(getAccessToken);
            if (synced) await hydrateFromSession(synced);
            const primaryAfter =
              getPrimaryWalletAddress(synced) ??
              expected ??
              getPrimaryWalletAddress(useAuthStore.getState().user);
            if (primaryAfter) {
              wallet = findPrivyWalletByAddress(
                walletsRef.current,
                primaryAfter,
              );
            }
            if (!wallet && !expected) {
              wallet = walletsRef.current[0];
            }
          }

          if (shouldCancel()) return;

          if (!wallet) {
            reportFailure(
              new Error(
                "We couldn't finish connecting your wallet. Please try connecting again.",
              ),
              "TIMEOUT",
            );
            return;
          }

          const matchNorm = normalizeWalletAddress(wallet.address);
          if (expected && matchNorm && matchNorm !== expected) {
            trackEvent("wallet_account_mismatch", {
              error_code: "ACCOUNT_MISMATCH",
            });
            failWalletActivation(
              "ACCOUNT_MISMATCH",
              "The wallet in MetaMask does not match your Tokenable account wallet. Switch accounts or reconnect.",
            );
            openWalletMismatch();
            pushConnectToast(
              "Wallet mismatch",
              "The connected wallet does not match your Tokenable account.",
            );
            return;
          }
        } else {
          wallet =
            (expected
              ? findPrivyWalletByAddress(walletsRef.current, expected)
              : undefined) ??
            resolveActivePrivyWallet(
              walletsRef.current,
              expected ?? undefined,
            ) ??
            walletsRef.current[0];

          if (!wallet) {
            wallet = expected
              ? await waitForPrivyWalletByAddress(
                  () => walletsRef.current,
                  expected,
                  {
                    timeoutMs: 15_000,
                    pauseWhileHidden: true,
                    shouldCancel,
                  },
                )
              : await waitForAnyPrivyWallet(() => walletsRef.current, {
                  timeoutMs: 15_000,
                  pauseWhileHidden: true,
                  shouldCancel,
                });
          }

          if (shouldCancel()) return;
          if (!wallet) {
            reportFailure(
              new Error("Account wallet not found in Privy session."),
              "WALLET_UNAVAILABLE",
            );
            return;
          }
        }

        setWalletActivationPhase("reconciling");
        await reconcileActiveWallet(wallet);
        if (shouldCancel()) return;

        const syncedAfter = await refreshPrivyAuthSession(getAccessToken);
        if (syncedAfter) await hydrateFromSession(syncedAfter);

        finishWalletActivation();
        trackEvent("wallet_connected", {
          provider: expected ? "reconnect" : "link",
        });
        navigateAfterSuccess();
      } catch (err) {
        if (shouldCancel()) return;
        reportFailure(err, "ACTIVATION_FAILED");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- phase-driven reconcile
  }, [phase, ready, authenticated, expectedAddress]);

  return null;
}
