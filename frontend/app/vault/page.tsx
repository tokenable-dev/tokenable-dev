"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { VaultPageBody } from "@/components/vault/VaultPageBody";
import {
  GradientOutlineFrame,
  VAULT_OUTLINE_PAD_CLASS,
} from "@/components/ui/GradientOutlineFrame";

const STEPS = [
  { num: 1, label: "Ship to Vault" },
  { num: 2, label: "Confirm + Verify" },
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

function Stepper({ active }: { active: number }) {
  return (
    <div className="mb-10">
      <div className="flex items-center justify-center sm:hidden">
        {STEPS.map((s, i) => {
          const isActive = s.num === active;
          const isDone = s.num < active;
          return (
            <div key={s.num} className="flex items-center">
              {isActive ? (
                <GradientOutlineFrame
                  roundedClass="rounded-full"
                  className="shrink-0"
                  padClass={VAULT_OUTLINE_PAD_CLASS}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-xs font-bold text-mint">
                    {isDone ? "✓" : s.num}
                  </div>
                </GradientOutlineFrame>
              ) : (
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                    isDone
                      ? "border-gray-500 bg-transparent text-gray-400"
                      : "border-gray-700 bg-transparent text-gray-600"
                  }`}
                >
                  {isDone ? "✓" : s.num}
                </div>
              )}
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-px w-7 ${
                    s.num < active ? "bg-gray-600" : "bg-gray-800"
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
                {isActive ? (
                  <GradientOutlineFrame
                    roundedClass="rounded-full"
                    className="shrink-0"
                    padClass={VAULT_OUTLINE_PAD_CLASS}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-bold text-mint">
                      {isDone ? "✓" : s.num}
                    </div>
                  </GradientOutlineFrame>
                ) : (
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                      isDone
                        ? "border-gray-500 bg-transparent text-gray-400"
                        : "border-gray-700 bg-transparent text-gray-600"
                    }`}
                  >
                    {isDone ? "✓" : s.num}
                  </div>
                )}
                <span
                  className={`whitespace-nowrap text-xs font-medium sm:text-sm ${
                    isActive
                      ? "text-mint"
                      : isDone
                        ? "text-gray-400"
                        : "text-gray-600"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-px w-10 shrink-0 sm:mx-3 sm:w-14 ${
                    s.num < active ? "bg-gray-600" : "bg-gray-800"
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
    <div className="min-h-screen min-w-0 overflow-x-clip bg-black text-white">
      <Suspense fallback={null}>
        <LegacyVaultTabRedirect />
      </Suspense>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-20">
        <Stepper active={1} />

        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Sell your collectibles
          </h1>
        </header>

        <VaultPageBody />
      </div>
    </div>
  );
}
