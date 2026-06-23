"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { unlinkWalletFromAccount, sendVerificationEmail } from "@/lib/auth";
import { getUserLinkedWallets } from "@/lib/auth/wallets";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, initialized, refresh, logout } = useAuthStore();
  const openConnectWallet = useAuthUiStore((s) => s.openConnectWallet);
  const [busy, setBusy] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  const linkedWallets = getUserLinkedWallets(user);

  useEffect(() => {
    if (!loading && initialized && !user) {
      router.replace("/login");
    }
  }, [user, loading, initialized, router]);

  async function handleUnlink(walletAddress: string) {
    setUnlinking(walletAddress);
    try {
      await unlinkWalletFromAccount(walletAddress);
      await refresh();
    } finally {
      setUnlinking(null);
    }
  }

  async function handleResendVerification() {
    setBusy(true);
    try {
      await sendVerificationEmail();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-950 flex items-center justify-center">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
      </div>
    );
  }

  const displayName = user.name?.trim() || user.email.split("@")[0];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
      <main className="mx-auto max-w-lg px-4 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {user.pictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.pictureUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full border border-gray-700 object-cover"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-sm font-semibold text-mint">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold">{displayName}</h1>
              <p className="truncate text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout().then(() => router.push("/"))}
            className="shrink-0 text-sm text-gray-500 hover:text-red-400"
          >
            Log out
          </button>
        </div>

        <section className="mb-4 rounded-xl border border-gray-800 bg-gray-900/30 p-5">
          <h2 className="text-sm font-semibold text-white">Wallets</h2>

          {linkedWallets.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {linkedWallets.map((w) => (
                <li
                  key={w.address}
                  className="flex flex-col gap-2 rounded-lg border border-gray-800/80 bg-black/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="select-all break-all font-mono text-[11px] leading-relaxed text-white sm:text-xs"
                      title={w.address}
                    >
                      {w.address}
                    </p>
                    {w.isPrimary ? (
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                        Primary
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={unlinking === w.address}
                    onClick={() => void handleUnlink(w.address)}
                    className="min-h-[40px] shrink-0 self-end text-xs text-gray-500 hover:text-red-400 disabled:opacity-50 sm:min-h-0 sm:self-auto"
                  >
                    {unlinking === w.address ? "…" : "Unlink"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No wallets linked.</p>
          )}

          <button
            type="button"
            onClick={() => openConnectWallet({ returnTo: "/profile" })}
            className="mt-4 min-h-[48px] w-full rounded-lg border border-mint/25 bg-mint/[0.06] py-2.5 text-sm font-semibold text-mint hover:bg-mint/[0.1]"
          >
            Add wallet
          </button>
          <p className="mt-2 text-xs text-gray-500">
            Connect MetaMask and sign once to link a wallet to your account.
          </p>
        </section>

        {!user.emailVerified ? (
          <section className="flex items-center justify-between gap-3 rounded-xl border border-mint/20 bg-mint/5 px-4 py-3">
            <span className="text-xs font-medium text-mint">Verify email</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleResendVerification()}
              className="text-xs font-semibold text-mint hover:text-mint/80 disabled:opacity-50"
            >
              Resend
            </button>
          </section>
        ) : null}
      </main>
    </div>
  );
}
