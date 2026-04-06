"use client";

import Link from "next/link";
import { useState } from "react";
import { ASSETS } from "@/constants/assets";
import { sendVerificationEmail } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";

/** IP 배포 등에서 Google OAuth 미사용 시 CI에서 NEXT_PUBLIC_SHOW_AUTH_LINKS=false 로 빌드 */
const showAuthLinks =
  process.env.NEXT_PUBLIC_SHOW_AUTH_LINKS !== "false";

export function AppHeader() {
  const { user, loading, logout, refresh } = useAuthStore();
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  async function handleResendVerification() {
    setResendMsg(null);
    try {
      await sendVerificationEmail();
      setResendMsg("인증 메일을 보냈습니다. 메일함을 확인해 주세요.");
      await refresh();
    } catch (e) {
      setResendMsg(e instanceof Error ? e.message : "재발송에 실패했습니다.");
    }
  }

  return (
    <>
    <header className="border-b border-gray-800/60 backdrop-blur-sm sticky top-0 z-50 bg-gray-950/90">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <img
              src={ASSETS.logo.tokenable}
              alt="Tokenable"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
          </Link>
          <span className="hidden sm:inline text-xs bg-gray-800 text-gray-400 border border-gray-700 px-2 py-0.5 rounded-full whitespace-nowrap">
            Ethereum Sepolia
          </span>
        </div>

        <nav className="flex items-center gap-2 sm:gap-3 shrink-0">
          {loading ? (
            <span className="text-xs text-gray-500">…</span>
          ) : user ? (
            <>
              <span className="hidden md:inline text-xs text-gray-500 max-w-[160px] truncate">
                {user.email}
              </span>
              <Link
                href="/profile"
                className="text-sm font-medium text-mint hover:text-mint-dim transition-colors"
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Log out
              </button>
            </>
          ) : showAuthLinks ? (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-gray-300 hover:text-white transition-colors px-2 py-1.5"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="text-sm font-semibold bg-mint-dim hover:brightness-110 text-mint-ink rounded-lg px-3 py-1.5 transition-colors"
              >
                Sign up
              </Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
    {user && !user.platformEmailVerifiedAt && (
      <div className="border-b border-mint-deep/30 bg-mint/[0.06] px-4 py-2.5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-200">
          <p>
            <span className="font-medium text-mint">이메일 인증이 필요합니다.</span>{" "}
            가입 시 보낸 메일의 링크를 클릭하거나 아래에서 다시 보내 주세요.
          </p>
          <div className="flex items-center gap-3 shrink-0">
            {resendMsg && (
              <span className="text-xs text-mint/85 max-w-[240px]">{resendMsg}</span>
            )}
            <button
              type="button"
              onClick={() => void handleResendVerification()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-mint-dim hover:brightness-110 text-mint-ink whitespace-nowrap"
            >
              인증 메일 다시 보내기
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
