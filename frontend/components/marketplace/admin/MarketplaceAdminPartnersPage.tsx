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
import { AdminPartnerOriginPanel } from "./AdminPartnerOriginPanel";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

const ETH_ADDR = /^0x[a-fA-F0-9]{40}$/;
const PK = /^(0x)?[a-fA-F0-9]{64}$/;

function shortWallet(addr: string): string {
  const s = addr.trim();
  if (s.length < 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

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
  const [originId, setOriginId] = useState<string | null>(null);

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
      if (pk && !PK.test(pk)) throw new Error("Private key must be 32-byte hex when provided.");
      return postAdminMarketplacePartner({
        displayName: name,
        walletAddress: wallet,
        ...(pk ? { privateKey: pk } : {}),
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
        subtitle="Register company wallets for Partner vault and optional partner mint and list. Private keys are optional for Partner vault eligibility; bulk mint requires a key encrypted at rest."
      />

      <p className={`mb-6 text-sm ${ADMIN_TEXT_SECONDARY}`}>
        Active partners with a company Origin address can use{" "}
        <strong>Partner vault</strong> in the sell flow. Listings and portfolio show{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
          {"{company name} vault"}
        </code>
        . Origin is the FedEx ship-from for Partner vault redeems — edit it below
        or from the partner&rsquo;s Settings. After adding a private key, use{" "}
        <a
          className="font-medium text-[var(--brand-500)] hover:underline"
          href="/marketplace/admin/bulk-mint"
        >
          Partner bulk mint
        </a>{" "}
        with certNumber + price rows.
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
            Private key (optional — required later for bulk mint)
          </label>
          <input
            id="partner-pk"
            className={ADMIN_INPUT_MONO}
            type="password"
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="Leave blank for Partner vault only"
            autoComplete="off"
          />
          <p className={`mt-1 text-xs ${ADMIN_TEXT_MUTED}`}>
            When set, must match the wallet address. Stored AES-256-GCM encrypted — not returned by
            the API. Skip for Partner vault access without bulk mint.
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
          <>
            <div className="hidden overflow-auto rounded-md border border-zinc-200 md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Wallet</th>
                    <th className="px-3 py-2 font-medium">Key</th>
                    <th className="px-3 py-2 font-medium">Origin</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p: AdminMarketplacePartner) => (
                    <PartnerTableRow
                      key={p.id}
                      partner={p}
                      rotateId={rotateId}
                      rotateKey={rotateKey}
                      originOpen={originId === p.id}
                      patchPending={patchMutation.isPending}
                      onRename={(next) =>
                        patchMutation.mutate({
                          id: p.id,
                          body: { displayName: next },
                        })
                      }
                      onToggleActive={() =>
                        patchMutation.mutate({
                          id: p.id,
                          body: { isActive: !p.isActive },
                        })
                      }
                      onOpenOrigin={() =>
                        setOriginId((cur) => (cur === p.id ? null : p.id))
                      }
                      onStartRotate={() => {
                        setRotateId(p.id);
                        setRotateKey("");
                      }}
                      onCancelRotate={() => {
                        setRotateId(null);
                        setRotateKey("");
                      }}
                      onRotateKeyChange={setRotateKey}
                      onSaveRotate={() => {
                        if (!PK.test(rotateKey.trim())) {
                          window.alert("Enter a valid 32-byte hex private key.");
                          return;
                        }
                        patchMutation.mutate({
                          id: p.id,
                          body: { privateKey: rotateKey.trim() },
                        });
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden">
              {partners.map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border border-zinc-200 bg-white p-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <input
                      className={`${ADMIN_INPUT} min-w-0 flex-1`}
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
                    <span
                      className={
                        p.isActive
                          ? "shrink-0 text-xs font-semibold text-emerald-700"
                          : "shrink-0 text-xs text-zinc-500"
                      }
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className={`mb-1 font-mono text-xs ${ADMIN_TEXT_SECONDARY}`}>
                    {shortWallet(p.walletAddress)}
                  </p>
                  <p className={`mb-3 text-xs ${ADMIN_TEXT_MUTED}`}>
                    Key: {p.hasPrivateKey ? "Yes" : "Partner vault only"} · Origin:{" "}
                    {p.hasCompanyAddress ? "Set" : "Missing"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={ADMIN_BTN_SECONDARY}
                      onClick={() =>
                        setOriginId((cur) => (cur === p.id ? null : p.id))
                      }
                    >
                      {originId === p.id ? "Hide Origin" : "Origin"}
                    </button>
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
                    <button
                      type="button"
                      className={ADMIN_BTN_SECONDARY}
                      onClick={() => {
                        setRotateId(p.id);
                        setRotateKey("");
                      }}
                    >
                      Rotate key
                    </button>
                  </div>
                  {rotateId === p.id ? (
                    <div className="mt-3 space-y-2">
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
                  ) : null}
                  {originId === p.id ? (
                    <AdminPartnerOriginPanel
                      partnerId={p.id}
                      partnerName={p.displayName}
                      onClose={() => setOriginId(null)}
                    />
                  ) : null}
                </li>
              ))}
            </ul>

            {originId ? (
              <div className="hidden md:block">
                {partners
                  .filter((p) => p.id === originId)
                  .map((p) => (
                    <AdminPartnerOriginPanel
                      key={p.id}
                      partnerId={p.id}
                      partnerName={p.displayName}
                      onClose={() => setOriginId(null)}
                    />
                  ))}
              </div>
            ) : null}
          </>
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

function PartnerTableRow({
  partner: p,
  rotateId,
  rotateKey,
  originOpen,
  patchPending,
  onRename,
  onToggleActive,
  onOpenOrigin,
  onStartRotate,
  onCancelRotate,
  onRotateKeyChange,
  onSaveRotate,
}: {
  partner: AdminMarketplacePartner;
  rotateId: string | null;
  rotateKey: string;
  originOpen: boolean;
  patchPending: boolean;
  onRename: (next: string) => void;
  onToggleActive: () => void;
  onOpenOrigin: () => void;
  onStartRotate: () => void;
  onCancelRotate: () => void;
  onRotateKeyChange: (v: string) => void;
  onSaveRotate: () => void;
}) {
  return (
    <tr className="border-t border-zinc-100 align-top">
      <td className="px-3 py-2 font-medium text-zinc-900">
        <input
          className={`${ADMIN_INPUT} min-w-[140px]`}
          defaultValue={p.displayName}
          aria-label={`Rename ${p.displayName}`}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (!next || next === p.displayName) return;
            onRename(next);
          }}
        />
      </td>
      <td className="px-3 py-2 font-mono text-xs text-zinc-700">
        {p.walletAddress}
      </td>
      <td className="px-3 py-2 text-xs text-zinc-600">
        {p.hasPrivateKey ? "Yes" : "Partner vault only"}
      </td>
      <td className="px-3 py-2 text-xs">
        <button
          type="button"
          className={
            p.hasCompanyAddress
              ? "font-medium text-emerald-700 underline-offset-2 hover:underline"
              : "font-medium text-amber-700 underline-offset-2 hover:underline"
          }
          onClick={onOpenOrigin}
        >
          {originOpen
            ? "Hide"
            : p.hasCompanyAddress
              ? "Set · view"
              : "Missing · add"}
        </button>
      </td>
      <td className="px-3 py-2">
        <span className={p.isActive ? "text-emerald-700" : "text-zinc-500"}>
          {p.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="space-y-2 px-3 py-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={ADMIN_BTN_SECONDARY}
            disabled={patchPending}
            onClick={onToggleActive}
          >
            {p.isActive ? "Deactivate" : "Activate"}
          </button>
          {rotateId === p.id ? null : (
            <button
              type="button"
              className={ADMIN_BTN_SECONDARY}
              onClick={onStartRotate}
            >
              Rotate key
            </button>
          )}
        </div>
        {rotateId === p.id ? (
          <div className="mt-2 space-y-2">
            <input
              className={ADMIN_INPUT_MONO}
              type="password"
              placeholder="New private key"
              value={rotateKey}
              onChange={(e) => onRotateKeyChange(e.target.value)}
              autoComplete="off"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={ADMIN_BTN_PRIMARY}
                disabled={patchPending}
                onClick={onSaveRotate}
              >
                Save key
              </button>
              <button
                type="button"
                className={ADMIN_BTN_SECONDARY}
                onClick={onCancelRotate}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </td>
    </tr>
  );
}
