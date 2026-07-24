"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAdminMarketplacePartners,
  patchAdminMarketplacePartner,
  postAdminMarketplacePartner,
  rq,
  type AdminMarketplacePartner,
} from "@/lib/core";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_PRIMARY,
  ADMIN_BTN_SECONDARY,
  ADMIN_INPUT,
  ADMIN_INPUT_MONO,
  ADMIN_LABEL,
  ADMIN_PANEL,
  ADMIN_TEXT_ERROR,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

const ETH_ADDR = /^0x[a-fA-F0-9]{40}$/;
const PK = /^(0x)?[a-fA-F0-9]{64}$/;

/**
 * Register consignment company wallets (display name + entrusted private key).
 * Private keys are write-only — never returned from the API.
 */
export function MarketplaceAdminPartnersPage() {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [rotateId, setRotateId] = useState<string | null>(null);
  const [rotateKey, setRotateKey] = useState("");

  const partnersQuery = useQuery({
    queryKey: rq.adminMarketplacePartners,
    queryFn: listAdminMarketplacePartners,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const name = displayName.trim();
      const wallet = walletAddress.trim();
      const pk = privateKey.trim();
      if (!name) throw new Error("Enter a company display name.");
      if (!ETH_ADDR.test(wallet)) throw new Error("Enter a valid wallet address (0x…).");
      if (!PK.test(pk)) throw new Error("Enter a 32-byte hex private key.");
      return postAdminMarketplacePartner({
        displayName: name,
        walletAddress: wallet,
        privateKey: pk,
      });
    },
    onSuccess: () => {
      setFormError(null);
      setDisplayName("");
      setWalletAddress("");
      setPrivateKey("");
      void queryClient.invalidateQueries({ queryKey: rq.adminMarketplacePartners });
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const patchMutation = useMutation({
    mutationFn: (args: {
      id: string;
      body: { displayName?: string; privateKey?: string; isActive?: boolean };
    }) => patchAdminMarketplacePartner(args.id, args.body),
    onSuccess: () => {
      setRotateId(null);
      setRotateKey("");
      void queryClient.invalidateQueries({ queryKey: rq.adminMarketplacePartners });
    },
  });

  const partners = partnersQuery.data ?? [];
  const activeCount = useMemo(
    () => partners.filter((p) => p.isActive).length,
    [partners],
  );

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Partners"
        subtitle="Register company wallets entrusted to Tokenable for partner mint & list. Private keys are encrypted at rest and never shown again."
      />

      <p className={`mb-6 text-sm ${ADMIN_TEXT_SECONDARY}`}>
        After registering a partner, use{" "}
        <a
          className="font-medium text-[var(--brand-500)] hover:underline"
          href="/marketplace/admin/bulk-mint"
        >
          Partner bulk mint
        </a>{" "}
        with an Excel of certNumber + price. Listings show the company display name;
        USDC from Seaport fills goes to the company wallet.
      </p>

      <section className={`${ADMIN_ARTICLE} mb-6 space-y-4`}>
        <h2 className="text-base font-semibold text-zinc-900">Add partner</h2>
        <div>
          <label className={ADMIN_LABEL} htmlFor="partner-name">
            Company display name
          </label>
          <input
            id="partner-name"
            className={ADMIN_INPUT}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Acme Collectibles"
            autoComplete="off"
          />
        </div>
        <div>
          <label className={ADMIN_LABEL} htmlFor="partner-wallet">
            Wallet address
          </label>
          <input
            id="partner-wallet"
            className={ADMIN_INPUT_MONO}
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="0x…"
            autoComplete="off"
          />
        </div>
        <div>
          <label className={ADMIN_LABEL} htmlFor="partner-pk">
            Private key (write-only)
          </label>
          <input
            id="partner-pk"
            className={ADMIN_INPUT_MONO}
            type="password"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="0x… or 64 hex chars"
            autoComplete="off"
          />
          <p className={`mt-1 text-xs ${ADMIN_TEXT_MUTED}`}>
            Must match the wallet address. Stored AES-256-GCM encrypted — not returned by
            the API.
          </p>
        </div>
        {formError || createMutation.isError ? (
          <p className={ADMIN_TEXT_ERROR} role="alert">
            {formError ??
              (createMutation.error instanceof Error
                ? createMutation.error.message
                : "Create failed")}
          </p>
        ) : null}
        <button
          type="button"
          className={ADMIN_BTN_PRIMARY}
          disabled={createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "Saving…" : "Register partner"}
        </button>
      </section>

      <section className={`${ADMIN_PANEL} space-y-4 p-4 sm:p-5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">Registered partners</h2>
          <p className={`text-xs ${ADMIN_TEXT_MUTED}`}>
            {activeCount} active / {partners.length} total
          </p>
        </div>
        {partnersQuery.isLoading ? (
          <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>Loading…</p>
        ) : partnersQuery.isError ? (
          <p className={ADMIN_TEXT_ERROR} role="alert">
            {partnersQuery.error instanceof Error
              ? partnersQuery.error.message
              : "Failed to load partners"}
          </p>
        ) : !partners.length ? (
          <p className={`text-sm ${ADMIN_TEXT_MUTED}`}>No partners yet.</p>
        ) : (
          <div className="overflow-auto rounded-md border border-zinc-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Wallet</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p: AdminMarketplacePartner) => (
                  <tr key={p.id} className="border-t border-zinc-100 align-top">
                    <td className="px-3 py-2 font-medium text-zinc-900">
                      <input
                        className={`${ADMIN_INPUT} min-w-[140px]`}
                        defaultValue={p.displayName}
                        aria-label={`Rename ${p.displayName}`}
                        onBlur={(e) => {
                          const next = e.target.value.trim();
                          if (!next || next === p.displayName) return;
                          patchMutation.mutate({
                            id: p.id,
                            body: { displayName: next },
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-700">
                      {p.walletAddress}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          p.isActive ? "text-emerald-700" : "text-zinc-500"
                        }
                      >
                        {p.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="space-y-2 px-3 py-2">
                      <button
                        type="button"
                        className={ADMIN_BTN_SECONDARY}
                        disabled={patchMutation.isPending}
                        onClick={() =>
                          patchMutation.mutate({
                            id: p.id,
                            body: { isActive: !p.isActive },
                          })
                        }
                      >
                        {p.isActive ? "Deactivate" : "Activate"}
                      </button>
                      {rotateId === p.id ? (
                        <div className="mt-2 space-y-2">
                          <input
                            className={ADMIN_INPUT_MONO}
                            type="password"
                            placeholder="New private key"
                            value={rotateKey}
                            onChange={(e) => setRotateKey(e.target.value)}
                            autoComplete="off"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={ADMIN_BTN_PRIMARY}
                              disabled={patchMutation.isPending}
                              onClick={() => {
                                if (!PK.test(rotateKey.trim())) {
                                  window.alert("Enter a valid 32-byte hex private key.");
                                  return;
                                }
                                patchMutation.mutate({
                                  id: p.id,
                                  body: { privateKey: rotateKey.trim() },
                                });
                              }}
                            >
                              Save key
                            </button>
                            <button
                              type="button"
                              className={ADMIN_BTN_SECONDARY}
                              onClick={() => {
                                setRotateId(null);
                                setRotateKey("");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={`${ADMIN_BTN_SECONDARY} ml-2`}
                          onClick={() => {
                            setRotateId(p.id);
                            setRotateKey("");
                          }}
                        >
                          Rotate key
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {patchMutation.isError ? (
          <p className={ADMIN_TEXT_ERROR} role="alert">
            {patchMutation.error instanceof Error
              ? patchMutation.error.message
              : "Update failed"}
          </p>
        ) : null}
      </section>
    </>
  );
}
