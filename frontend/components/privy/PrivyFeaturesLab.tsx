"use client";

import { useEffect, useState } from "react";
import {
  useExportWallet,
  useFiatOnramp,
  useFundWallet,
  useLogin,
  useMfaEnrollment,
  usePrivy,
  useSignMessage,
  useWallets,
} from "@privy-io/react-auth";
import { WalletsDialog } from "@privy-io/react-auth/ui";
import { PrivyUserPill } from "@/components/privy/PrivyUserPill";
import {
  PRIVY_CLIENT_FEATURE_MATRIX,
  resolvePrivyLoginMethodsOrder,
} from "@/lib/privy/features";
import { backendFetch, getApiUrl } from "@/lib/core/api/client";
import {
  chainIdToCaip2,
  resolveDefaultFundingAmount,
  resolveFundingTargetChainId,
  resolvePrivyFundingEnvironment,
  TOKENABLE_FUNDING_ASSET,
} from "@/lib/privy/funding";
import { getChainDefinition } from "@/lib/chains";
import { usePrivyFundingStatus } from "@/hooks/wallet/usePrivyFundingStatus";
import { useAuthStore } from "@/store/authStore";

type CatalogResponse = {
  total: number;
  categories: Record<string, unknown[]>;
  entries?: Array<{ id: string; name: string; category: string; status: string }>;
};

function FeatureRow({
  title,
  hook,
  status,
  note,
  children,
}: {
  title: string;
  hook: string;
  status: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-gray-500">{hook}</p>
        </div>
        <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-400">
          {status}
        </span>
      </div>
      {note ? <p className="mb-3 text-xs text-amber-200/80">{note}</p> : null}
      {children}
    </section>
  );
}

const API_DOCS_HINT = "http://localhost:4100/api/docs";

/** Dev lab — trigger Privy-native flows (MoonPay via useFiatOnramp on Amoy test). */
export function PrivyFeaturesLab() {
  const { ready, authenticated, user: privyUser } = usePrivy();
  const { login } = useLogin();
  const { fundWallet } = useFundWallet();
  const { fund: startFiatOnramp } = useFiatOnramp();
  const { showMfaEnrollmentModal } = useMfaEnrollment();
  const { exportWallet } = useExportWallet();
  const { signMessage } = useSignMessage();
  const { wallets } = useWallets();
  const tokenableUser = useAuthStore((s) => s.user);
  const fundingTargetChainId = resolveFundingTargetChainId();
  const fundingTargetCaip2 = chainIdToCaip2(fundingTargetChainId);
  const fundingStatus = usePrivyFundingStatus();
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const primaryWallet = wallets[0]?.address ?? tokenableUser?.walletAddress ?? undefined;

  useEffect(() => {
    void backendFetch(`${getApiUrl()}/privy/catalog`)
      .then((r) => r.json())
      .then((data) => setCatalog(data as CatalogResponse))
      .catch((e) =>
        setCatalogError(e instanceof Error ? e.message : "Could not load catalog"),
      );
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Privy feature lab</h1>
        <p className="mt-2 text-sm text-gray-400">
          Native Privy UI only. Server catalog:{" "}
          <a href={`${getApiUrl()}/privy/catalog`} className="text-indigo-400 hover:underline">
            GET /api/privy/catalog
          </a>{" "}
          · Swagger:{" "}
          <a href={API_DOCS_HINT} className="text-indigo-400 hover:underline" target="_blank" rel="noreferrer">
            /api/docs
          </a>
        </p>
      </div>

      <FeatureRow title="Account" hook="UserPill / useLogin" status="enabled">
        <div className="flex flex-wrap items-center gap-3">
          <PrivyUserPill
            action={authenticated ? undefined : { type: "login" }}
            ui={{ minimal: true, background: "secondary" }}
          />
          {!authenticated && ready ? (
            <button
              type="button"
              onClick={() => login()}
              className="text-xs text-indigo-400 hover:underline"
            >
              Open login modal
            </button>
          ) : null}
        </div>
        {authenticated ? (
          <p className="mt-3 break-all font-mono text-[11px] text-gray-500">
            Privy ID: {privyUser?.id}
          </p>
        ) : null}
      </FeatureRow>

      <FeatureRow
        title="Login methods (config)"
        hook="privyClientConfig.loginMethodsAndOrder"
        status={`primary: ${resolvePrivyLoginMethodsOrder().primary.join(", ")}`}
      >
        <p className="text-xs text-gray-400">
          Overflow: {resolvePrivyLoginMethodsOrder().overflow?.join(", ") || "(none)"}
          {" · "}
          Set <code className="text-gray-300">NEXT_PUBLIC_PRIVY_FULL_LOGIN=true</code> for all
          methods (Dashboard must enable each).
        </p>
      </FeatureRow>

      <FeatureRow title="Wallets dialog" hook="WalletsDialog" status="enabled">
        <WalletsDialog />
      </FeatureRow>

      <FeatureRow title="Link wallet" hook="UserPill connectWallet" status="enabled">
        <PrivyUserPill
          action={{ type: "connectWallet", options: { description: "Link MetaMask via Privy" } }}
        />
      </FeatureRow>

      <FeatureRow
        title="Fiat on-ramp — MoonPay (card · Apple Pay · Google Pay)"
        hook="useFiatOnramp → fund()"
        status="amoy-sandbox"
        note="Pay test: Amoy + MoonPay sandbox. Check fundingReadiness via GET /api/privy/apps/settings."
      >
        <button
          type="button"
          disabled={
            !authenticated ||
            !primaryWallet ||
            fundingStatus.ready === false ||
            fundingStatus.chainAligned === false
          }
          onClick={() =>
            void startFiatOnramp({
              destination: {
                asset: TOKENABLE_FUNDING_ASSET,
                chain: fundingTargetCaip2,
                address: primaryWallet!,
              },
              source: { assets: ["usd"], defaultAsset: "usd" },
              environment: resolvePrivyFundingEnvironment(),
              defaultAmount: resolveDefaultFundingAmount(),
            }).catch(() => undefined)
          }
          className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-200 disabled:opacity-40"
        >
          Start MoonPay on-ramp (USDC · {fundingTargetCaip2})
        </button>
        {fundingStatus.chainAligned === false ? (
          <p className="mt-2 text-xs text-amber-300/90">
            Dashboard default chain is {fundingStatus.defaultRecommendedChain ?? "unset"} — set
            Amoy + USDC or Ethereum + USDC in{" "}
            <a href={fundingStatus.dashboardUrl} className="underline" target="_blank" rel="noreferrer">
              Account Funding
            </a>
          </p>
        ) : fundingStatus.ready === false ? (
          <p className="mt-2 text-xs text-amber-300/90">
            MoonPay not ready —{" "}
            <a href={fundingStatus.dashboardUrl} className="underline" target="_blank" rel="noreferrer">
              configure Account Funding
            </a>
          </p>
        ) : null}
      </FeatureRow>

      <FeatureRow
        title="Fund wallet (legacy Privy modal)"
        hook="useFundWallet → fundWallet()"
        status="amoy-sandbox"
      >
        <button
          type="button"
          disabled={
            !authenticated ||
            !primaryWallet ||
            fundingStatus.ready === false ||
            fundingStatus.chainAligned === false
          }
          onClick={() => {
            const chain = getChainDefinition(fundingTargetChainId).viemChain;
            void fundWallet({
              address: primaryWallet!,
              options: {
                chain,
                asset: "USDC",
                amount: resolveDefaultFundingAmount(),
                defaultFundingMethod: "card",
                card: { preferredProvider: "moonpay" },
              },
            }).catch(() => undefined);
          }}
          className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 disabled:opacity-40"
        >
          Fund wallet (MoonPay modal · chain {fundingTargetChainId})
        </button>
      </FeatureRow>

      <FeatureRow
        title="Bank deposit (out of scope)"
        hook="useFundWalletWithBankDeposit"
        status="disabled — MoonPay only"
        note="Bridge / bank transfers are not used in Tokenable. MoonPay card on-ramp only."
      >
        <button
          type="button"
          disabled
          className="rounded-lg border border-gray-800 px-3 py-2 text-sm text-gray-600 opacity-50"
        >
          Not enabled (MoonPay only)
        </button>
      </FeatureRow>

      <FeatureRow
        title="MFA enrollment"
        hook="useMfaEnrollment → showMfaEnrollmentModal()"
        status="dashboard-only"
      >
        <button
          type="button"
          disabled={!authenticated}
          onClick={() => showMfaEnrollmentModal()}
          className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 disabled:opacity-40"
        >
          Enroll MFA (Privy modal)
        </button>
      </FeatureRow>

      <FeatureRow title="Export embedded wallet" hook="useExportWallet → exportWallet()" status="dashboard-only">
        <button
          type="button"
          disabled={!authenticated || !primaryWallet}
          onClick={() => void exportWallet({ address: primaryWallet! })}
          className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 disabled:opacity-40"
        >
          Export wallet key / seed
        </button>
      </FeatureRow>

      <FeatureRow title="Sign message" hook="useSignMessage → signMessage()" status="enabled">
        <button
          type="button"
          disabled={!authenticated}
          onClick={() => void signMessage({ message: "Tokenable Privy lab" })}
          className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 disabled:opacity-40"
        >
          Sign test message
        </button>
      </FeatureRow>

      <div className="rounded-xl border border-gray-800 bg-black/30 p-4">
        <h2 className="text-sm font-semibold text-white">Client feature matrix</h2>
        <ul className="mt-3 space-y-2">
          {PRIVY_CLIENT_FEATURE_MATRIX.map((f) => (
            <li key={f.id} className="flex justify-between gap-4 text-xs text-gray-400">
              <span>{f.label}</span>
              <span className="shrink-0 text-gray-500">{f.status}</span>
            </li>
          ))}
        </ul>
      </div>

      {catalog ? (
        <div className="rounded-xl border border-gray-800 bg-black/30 p-4">
          <h2 className="text-sm font-semibold text-white">
            Server catalog ({catalog.total} entries)
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Categories: {Object.keys(catalog.categories).join(" · ")}
          </p>
          {catalog.entries ? (
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-[11px] text-gray-500">
              {catalog.entries.slice(0, 24).map((e) => (
                <li key={e.id}>
                  [{e.category}] {e.name} — {e.status}
                </li>
              ))}
              {catalog.entries.length > 24 ? (
                <li className="text-gray-600">…and {catalog.entries.length - 24} more</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}
      {catalogError ? (
        <p className="text-xs text-red-400">Catalog: {catalogError}</p>
      ) : null}
    </div>
  );
}
