"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { WalletConnect } from "@/components/wallet/WalletConnect";
import {
  linkWalletToAccount,
  sendVerificationEmail,
  unlinkWalletFromAccount,
} from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading, initialized, refresh, logout } = useAuthStore();
  const { address, isConnected } = useAccount();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && initialized && !user) {
      router.replace("/login");
    }
  }, [user, loading, initialized, router]);

  async function handleLink() {
    if (!address) return;
    setBusy(true);
    setMsg(null);
    try {
      await linkWalletToAccount(address);
      await refresh();
      setMsg("Wallet linked to your account.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to link wallet");
    } finally {
      setBusy(false);
    }
  }

  async function handleResendVerification() {
    setBusy(true);
    setMsg(null);
    try {
      await sendVerificationEmail();
      await refresh();
      setMsg("인증 메일을 보냈습니다. 메일함을 확인해 주세요.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "재발송 실패");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink() {
    setBusy(true);
    setMsg(null);
    try {
      await unlinkWalletFromAccount();
      await refresh();
      setMsg("Wallet unlinked.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to unlink");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-950 flex items-center justify-center text-gray-500 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white">
      <main className="max-w-lg mx-auto px-4 py-10">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold">Profile</h1>
            <p className="text-sm text-gray-500 mt-1">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout().then(() => router.push("/"))}
            className="text-xs text-gray-500 hover:text-red-400"
          >
            Log out
          </button>
        </div>

        {user.pictureUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.pictureUrl}
            alt=""
            className="w-16 h-16 rounded-full mb-6 border border-gray-700"
          />
        )}
        {user.name && <p className="text-gray-300 mb-6">{user.name}</p>}

        <section className="rounded-xl border border-gray-800 bg-gray-900/30 p-6 space-y-3 mb-6">
          <h2 className="text-xs font-semibold text-mint/90 uppercase tracking-wider">
            Email verification
          </h2>
          {user.platformEmailVerifiedAt ? (
            <p className="text-sm text-mint/90">
              이메일 인증이 완료되었습니다.
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500 leading-relaxed">
                구글 로그인 직후 인증 메일이 발송됩니다. 메일의 링크를 눌러 플랫폼 이메일 인증을
                완료해 주세요.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleResendVerification()}
                className="text-sm font-semibold px-4 py-2 rounded-lg bg-mint/15 hover:bg-mint/25 border border-mint-deep/35 disabled:opacity-50 text-mint"
              >
                {busy ? "Sending…" : "인증 메일 다시 보내기"}
              </button>
            </>
          )}
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900/30 p-6 space-y-4">
          <h2 className="text-xs font-semibold text-mint/90 uppercase tracking-wider">
            Wallet (MetaMask)
          </h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Connect MetaMask, then link the address to this account. You can use a different
            connection on the Mint tab for transactions; linking here stores the address on your
            profile for future features.
          </p>
          <WalletConnect />
          {isConnected && address && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleLink()}
              className="w-full py-2.5 text-sm font-semibold rounded-lg bg-mint-dim hover:brightness-110 disabled:opacity-50 text-mint-ink"
            >
              {busy ? "Working…" : "Link this wallet to my account"}
            </button>
          )}
          {user.walletAddress && (
            <div className="pt-2 space-y-2">
              <p className="text-xs text-gray-500">Linked address</p>
              <p className="text-sm font-mono text-mint/90 break-all">{user.walletAddress}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleUnlink()}
                className="text-xs text-gray-500 hover:text-red-400"
              >
                Unlink wallet
              </button>
            </div>
          )}
          {msg && <p className="text-xs text-mint/90">{msg}</p>}
        </section>
      </main>
    </div>
  );
}
