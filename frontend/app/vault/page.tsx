"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { WalletConnect } from "@/components/wallet";
import { MintForm } from "@/components/mint";
import { MyAssets } from "@/components/my-assets";
import { useAuthStore } from "@/store/authStore";

type Tab = "mint" | "my-rwa";

const STEPS = [
  { num: 1, label: "Request" },
  { num: 2, label: "Shipping" },
  { num: 3, label: "Verify" },
  { num: 4, label: "Mint" },
] as const;

function TabParamSync({ onTab }: { onTab: (t: Tab) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "my-rwa" || tab === "mint") {
      onTab(tab);
    }
  }, [searchParams, onTab]);
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
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((s, i) => {
        const isActive = s.num === active;
        const isDone = s.num < active;
        return (
          <div key={s.num} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-full border-2 text-sm font-bold transition-colors ${
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
                className={`w-12 sm:w-20 h-px mx-3 ${
                  s.num < active ? "bg-mint-deep/50" : "bg-gray-800"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function VaultPage() {
  const [activeTab, setActiveTab] = useState<Tab>("mint");

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <Suspense fallback={null}>
        <TabParamSync onTab={setActiveTab} />
      </Suspense>
      <Suspense fallback={null}>
        <EmailVerifyToastSync />
      </Suspense>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-20">
        {/* Tab selector */}
        <div className="flex gap-1 bg-gray-900/50 border border-gray-800 rounded-xl p-1 mb-8 max-w-xs mx-auto">
          <button
            onClick={() => setActiveTab("mint")}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "mint"
                ? "bg-mint/12 text-mint border border-mint-deep/35 shadow-sm shadow-mint/10"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Tokenize
          </button>
          <button
            onClick={() => setActiveTab("my-rwa")}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "my-rwa"
                ? "bg-mint/12 text-mint border border-mint-deep/35 shadow-sm shadow-mint/10"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            My Assets
          </button>
        </div>

        {activeTab === "mint" && (
          <>
            {/* Stepper */}
            <Stepper active={1} />

            {/* Title */}
            <div className="text-center mb-10">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
                Vault Tokenization
              </h1>
              <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
                Deposit your physical collectible into Tokenable Vault and
                receive tokenized ownership on-chain.
              </p>
            </div>

            {/* Wallet connect bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900/30 px-4 py-3 mb-6">
              <p className="text-xs text-gray-500 max-w-md">
                Connect MetaMask to tokenize your asset. Prefer linking the same
                address in{" "}
                <Link href="/profile" className="text-mint hover:underline">
                  Profile
                </Link>
                .
              </p>
              <WalletConnect />
            </div>

            {/* Mint Form */}
            <MintForm />
          </>
        )}

        {activeTab === "my-rwa" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-extrabold tracking-tight">
                My Assets
              </h1>
              <p className="text-xs text-gray-500">
                Click &ldquo;List for Sale&rdquo; to sell on the{" "}
                <Link href="/exchange" className="text-mint hover:underline">
                  Exchange
                </Link>
              </p>
            </div>
            <MyAssets />
          </div>
        )}
      </div>
    </div>
  );
}
