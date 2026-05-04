"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { MintForm } from "@/components/vault";
import { useAuthStore } from "@/store/authStore";

const STEPS = [
  { num: 1, label: "Request" },
  { num: 2, label: "Shipping" },
  { num: 3, label: "Verify" },
  { num: 4, label: "Mint" },
] as const;

/** Legacy `/vault?tab=my-rwa` → `/portfolio` (My Assets). */
function LegacyVaultTabRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("tab") === "my-rwa") {
      router.replace("/portfolio");
    }
  }, [searchParams, router]);

  return null;
}

function EmailVerifyToastSync() {
  const searchParams = useSearchParams();
  const refresh = useAuthStore((s) => s.refresh);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const v = searchParams.get("email_verify");
    if (!v) return;
    void refresh();
    const messages: Record<string, string> = {
      ok: "이메일 인증이 완료되었습니다.",
      invalid: "인증 링크가 만료되었거나 잘못되었습니다.",
      missing: "인증 요청이 올바르지 않습니다.",
    };
    setMsg(messages[v] ?? "이메일 인증을 확인할 수 없습니다.");
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.searchParams.delete("email_verify");
      window.history.replaceState({}, "", u.pathname + (u.search || ""));
    }
    const t = setTimeout(() => setMsg(null), 8000);
    return () => clearTimeout(t);
  }, [searchParams, refresh]);

  if (!msg) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] max-w-md w-[calc(100%-2rem)] -translate-x-1/2 px-4 py-3 rounded-lg bg-[#0a1210]/95 border border-mint/25 text-sm text-mint/95 shadow-xl shadow-mint/10 text-center">
      {msg}
    </div>
  );
}

function Stepper({ active }: { active: number }) {
  return (
    <div className="mb-10">
      <div className="flex items-center justify-center sm:hidden">
        {STEPS.map((s, i) => {
          const isActive = s.num === active;
          const isDone = s.num < active;
          return (
            <div key={s.num} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                  isActive
                    ? "border-mint bg-mint/15 text-mint"
                    : isDone
                      ? "border-mint-deep bg-mint-deep/20 text-mint-dim"
                      : "border-gray-700 bg-transparent text-gray-600"
                }`}
              >
                {isDone ? "✓" : s.num}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-px w-7 ${
                    s.num < active ? "bg-mint-deep/50" : "bg-gray-800"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden items-center justify-center gap-0 sm:flex">
        {STEPS.map((s, i) => {
          const isActive = s.num === active;
          const isDone = s.num < active;
          return (
            <div key={s.num} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                    isActive
                      ? "border-mint bg-mint/15 text-mint"
                      : isDone
                        ? "border-mint-deep bg-mint-deep/20 text-mint-dim"
                        : "border-gray-700 bg-transparent text-gray-600"
                  }`}
                >
                  {isDone ? "✓" : s.num}
                </div>
                <span
                  className={`text-sm font-medium ${
                    isActive
                      ? "text-mint"
                      : isDone
                        ? "text-mint-dim"
                        : "text-gray-600"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-3 h-px w-20 ${
                    s.num < active ? "bg-mint-deep/50" : "bg-gray-800"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function VaultPage() {
  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <Suspense fallback={null}>
        <LegacyVaultTabRedirect />
      </Suspense>
      <Suspense fallback={null}>
        <EmailVerifyToastSync />
      </Suspense>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-20">
        <Stepper active={1} />

        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Vault
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
            Deposit your slab, verify, mint your RWA on-chain.
          </p>
        </header>

        <MintForm />
      </div>
    </div>
  );
}
