"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { WalletConnect } from "@/components/wallet";
import { MintForm } from "@/components/mint";
import { MyAssets } from "@/components/my-assets";
import { Marketplace } from "@/components/marketplace";
import { useAuthStore } from "@/store/authStore";

type Tab = "mint" | "my-rwa" | "marketplace";

const TABS: { id: Tab; label: string }[] = [
  { id: "mint", label: "Mint" },
  { id: "my-rwa", label: "My Assets" },
  { id: "marketplace", label: "Exchange" },
];

/** Reads ?tab= param and syncs it to the parent state */
function TabParamSync({ onTab }: { onTab: (t: Tab) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "my-rwa" || tab === "marketplace" || tab === "mint") {
      onTab(tab);
    }
  }, [searchParams, onTab]);
  return null;
}

/** ?email_verify=ok|invalid|missing 처리 후 쿼리 제거 */
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

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("mint");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Reads ?tab= query param — must be in Suspense per Next.js requirement */}
      <Suspense fallback={null}>
        <TabParamSync onTab={setActiveTab} />
      </Suspense>
      <Suspense fallback={null}>
        <EmailVerifyToastSync />
      </Suspense>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-6">
        {/* <h1 className="mb-2">
          <img
            src={ASSETS.logo.tokenable}
            alt="Tokenable RWA Exchange"
            width={186}
            height={37}
            className="h-9 sm:h-10 w-auto"
          />
        </h1> */}
        <p className="text-gray-400 text-sm max-w-xl">
          Mint, collect, and trade tokenized assets on Ethereum Sepolia. Listings use
          OpenSea Seaport; prices are shown in USDC.
        </p>
      </section>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900/50 border border-gray-800 rounded-xl p-1 mb-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === tab.id
                  ? "bg-mint/12 text-mint border border-mint-deep/35 shadow-sm shadow-mint/10"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        {activeTab === "mint" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900/30 px-4 py-3">
              <p className="text-xs text-gray-500 max-w-md">
                Web3: connect MetaMask to mint & list. Prefer linking the same address in{" "}
                <Link href="/profile" className="text-mint hover:underline">
                  Profile
                </Link>{" "}
                after logging in.
              </p>
              <WalletConnect />
            </div>
            <MintForm />
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">
                How It Works
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    step: "01",
                    title: "Fill in Details",
                    desc: "Enter asset name, description, and upload your image",
                  },
                  {
                    step: "02",
                    title: "IPFS Upload",
                    desc: "Image and metadata are uploaded to Pinata IPFS",
                  },
                  {
                    step: "03",
                    title: "Sign & Mint",
                    desc: "Approve the transaction in MetaMask to mint your asset",
                  },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex gap-3">
                    <span className="text-xl font-black text-gray-700 shrink-0">
                      {step}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-200">
                        {title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "my-rwa" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">My Assets</h2>
              <p className="text-xs text-gray-500">
                Click &ldquo;List for Sale&rdquo; to sell on the Exchange
              </p>
            </div>
            <MyAssets />
          </div>
        )}

        {activeTab === "marketplace" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Exchange</h2>
              <p className="text-xs text-gray-500">Prices in USDC</p>
            </div>
            <Marketplace />
          </div>
        )}
      </main>
    </div>
  );
}
