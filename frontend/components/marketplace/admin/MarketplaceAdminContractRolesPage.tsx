"use client";

import { useMarketplaceAdminContractRoles } from "@/hooks/marketplace-admin/useMarketplaceAdminContractRoles";
import { useAppChain } from "@/providers/AppChainProvider";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_INPUT_MONO,
  ADMIN_LABEL,
  ADMIN_TABLE,
  ADMIN_TABLE_HEAD,
  ADMIN_TABLE_TD,
  ADMIN_TABLE_TH,
  ADMIN_TABLE_WRAP,
  ADMIN_TEXT_META,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function MarketplaceAdminContractRolesPage() {
  const { chain } = useAppChain();
  const {
    walletInput,
    setWalletInput,
    lookupWallet,
    lookup,
    overviewQuery,
    statusQuery,
    grantRole,
    revokeRole,
    busy,
  } = useMarketplaceAdminContractRoles();

  const overview = overviewQuery.data;
  const roles = overview?.roles ?? [];
  const status = statusQuery.data?.roles;

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Contract roles"
        subtitle={`Grant or revoke TokenableRWA AccessControl roles on ${chain.label}. Transactions are signed by the backend admin key (DEFAULT_ADMIN_ROLE). Switch network in the top bar to manage another chain.`}
      />

      {overviewQuery.isLoading ? (
        <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>Loading contract info…</p>
      ) : overviewQuery.isError ? (
        <p className="text-sm text-red-600" role="alert">
          {overviewQuery.error instanceof Error
            ? overviewQuery.error.message
            : "Failed to load overview"}
        </p>
      ) : overview ? (
        <div className={`${ADMIN_ARTICLE} mb-6 space-y-3`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className={`text-xs font-medium ${ADMIN_TEXT_META}`}>RWA contract</p>
              <p className="font-mono text-sm text-zinc-900">{overview.contractAddress}</p>
            </div>
            <div>
              <p className={`text-xs font-medium ${ADMIN_TEXT_META}`}>Chain ID</p>
              <p className="text-sm text-zinc-900">{overview.chainId}</p>
            </div>
            <div className="sm:col-span-2">
              <p className={`text-xs font-medium ${ADMIN_TEXT_META}`}>
                Backend admin signer (RWA_ADMIN_PRIVATE_KEY)
              </p>
              <p className="font-mono text-sm text-zinc-900">
                {overview.adminSignerAddress}
              </p>
              {!overview.adminSignerHasDefaultAdmin ? (
                <p className="mt-2 text-sm text-red-600" role="alert">
                  This wallet does not have DEFAULT_ADMIN_ROLE on-chain — grant/revoke will
                  fail until a holder grants it admin role.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className={`${ADMIN_ARTICLE} mb-6 space-y-4`}>
        <div>
          <label className={ADMIN_LABEL}>Wallet address</label>
          <div className="flex flex-wrap gap-2">
            <input
              className={`${ADMIN_INPUT_MONO} min-w-[16rem] flex-1`}
              placeholder="0x…"
              value={walletInput}
              onChange={(e) => setWalletInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  lookup();
                }
              }}
              spellCheck={false}
            />
            <button
              type="button"
              className={ADMIN_BTN_PRIMARY}
              onClick={lookup}
              disabled={busy}
            >
              Look up roles
            </button>
          </div>
          {lookupWallet ? (
            <p className={`mt-2 text-xs ${ADMIN_TEXT_META}`}>
              Showing on-chain roles for {shortAddr(lookupWallet)}
            </p>
          ) : null}
        </div>
      </div>

      {lookupWallet ? (
        statusQuery.isLoading ? (
          <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>Loading wallet roles…</p>
        ) : statusQuery.isError ? (
          <p className="text-sm text-red-600" role="alert">
            {statusQuery.error instanceof Error
              ? statusQuery.error.message
              : "Failed to load wallet roles"}
          </p>
        ) : status ? (
          <div className={ADMIN_TABLE_WRAP}>
            <table className={ADMIN_TABLE}>
              <thead className={ADMIN_TABLE_HEAD}>
                <tr>
                  <th className={ADMIN_TABLE_TH}>Role</th>
                  <th className={ADMIN_TABLE_TH}>Description</th>
                  <th className={ADMIN_TABLE_TH}>On-chain</th>
                  <th className={ADMIN_TABLE_TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => {
                  const active = status[role.key];
                  return (
                    <tr key={role.key}>
                      <td className={ADMIN_TABLE_TD}>
                        <span className="font-medium text-zinc-900">{role.label}</span>
                        <p className="font-mono text-xs text-zinc-500">{role.key}</p>
                      </td>
                      <td className={`${ADMIN_TABLE_TD} max-w-md text-zinc-700`}>
                        {role.description}
                      </td>
                      <td className={ADMIN_TABLE_TD}>
                        <span
                          className={
                            active
                              ? "inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200"
                              : "inline-flex rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200"
                          }
                        >
                          {active ? "Granted" : "Not granted"}
                        </span>
                      </td>
                      <td className={ADMIN_TABLE_TD}>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={ADMIN_BTN_PRIMARY}
                            disabled={busy || active || !overview?.adminSignerHasDefaultAdmin}
                            onClick={() => void grantRole(role.key)}
                          >
                            Grant
                          </button>
                          <button
                            type="button"
                            className={ADMIN_BTN_SECONDARY}
                            disabled={busy || !active || !overview?.adminSignerHasDefaultAdmin}
                            onClick={() => void revokeRole(role.key)}
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null
      ) : (
        <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>
          Enter a wallet address and click Look up roles to view and manage AccessControl
          assignments.
        </p>
      )}
    </>
  );
}
