"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { WalletConnect } from "@/components/WalletConnect";
import { TokenInfo } from "@/components/TokenInfo";
import { NftInfo } from "@/components/NftInfo";
import { NftMintForm } from "@/components/NftMintForm";
import { MyNfts } from "@/components/MyNfts";
import { Marketplace } from "@/components/Marketplace";

type Tab = "mint" | "my-nfts" | "marketplace";

const TABS: { id: Tab; label: string }[] = [
  { id: "mint", label: "Mint" },
  { id: "my-nfts", label: "My NFTs" },
  { id: "marketplace", label: "Marketplace" },
];

/** Reads ?tab= param and syncs it to the parent state */
function TabParamSync({ onTab }: { onTab: (t: Tab) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "my-nfts" || tab === "marketplace" || tab === "mint") {
      onTab(tab);
    }
  }, [searchParams, onTab]);
  return null;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("mint");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Reads ?tab= query param — must be in Suspense per Next.js requirement */}
      <Suspense fallback={null}>
        <TabParamSync onTab={setActiveTab} />
      </Suspense>

      {/* Header */}
      <header className="border-b border-gray-800/60 backdrop-blur-sm sticky top-0 z-10 bg-gray-950/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-lg" />
            <span className="font-bold text-lg tracking-tight">SKY NFT Marketplace</span>
            <span className="hidden sm:inline text-xs bg-gray-800 text-gray-400 border border-gray-700 px-2 py-0.5 rounded-full">
              Besu Chain
            </span>
          </div>
          <WalletConnect />
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
          SKY{" "}
          <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            NFT Marketplace
          </span>
        </h1>
        <p className="text-gray-400 text-sm max-w-xl">
          Mint, collect, and trade SkyNFTs on the Besu blockchain. Payments in USDC.
        </p>
      </section>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar stats */}
          <aside className="space-y-4 lg:col-span-1">
            <TokenInfo />
            <NftInfo />

            {/* Contract info */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">
                Contracts
              </h3>
              <div className="space-y-3">
                {[
                  {
                    label: "MockUSDC",
                    address: "0x318C92F6e913f1d1E90c0396270705B83918bCdb",
                  },
                  {
                    label: "SkyNFT",
                    address: "0x1ee4a6a6cbc4E15f73125233bc9447208c2dB8C1",
                  },
                  {
                    label: "Marketplace",
                    address: "0x17aCD061c56622fb00EB85b8F6927AA2c81A56bA",
                  },
                ].map(({ label, address }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-600 mb-0.5">{label}</p>
                    <p className="text-xs font-mono text-gray-400 break-all">{address}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Tab content */}
          <div className="lg:col-span-3">
            {/* Tabs */}
            <div className="flex gap-1 bg-gray-900/50 border border-gray-800 rounded-xl p-1 mb-5">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    activeTab === tab.id
                      ? "bg-gray-700 text-white shadow"
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
                <NftMintForm />
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">
                    How It Works
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      {
                        step: "01",
                        title: "Fill in Details",
                        desc: "Enter NFT name, description, and upload your image",
                      },
                      {
                        step: "02",
                        title: "IPFS Upload",
                        desc: "Image and metadata are uploaded to Pinata IPFS",
                      },
                      {
                        step: "03",
                        title: "Sign & Mint",
                        desc: "Approve the transaction in MetaMask to mint your NFT",
                      },
                    ].map(({ step, title, desc }) => (
                      <div key={step} className="flex gap-3">
                        <span className="text-xl font-black text-gray-700 shrink-0">
                          {step}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-200">{title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "my-nfts" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">My NFTs</h2>
                  <p className="text-xs text-gray-500">
                    Click &ldquo;List for Sale&rdquo; to sell on the marketplace
                  </p>
                </div>
                <MyNfts />
              </div>
            )}

            {activeTab === "marketplace" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Marketplace</h2>
                  <p className="text-xs text-gray-500">Prices in USDC</p>
                </div>
                <Marketplace />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
