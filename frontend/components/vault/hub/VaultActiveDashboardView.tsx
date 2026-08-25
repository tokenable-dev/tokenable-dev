"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { VaultThumb } from "@/components/vault/VaultThumb";
import { useActivePartner } from "@/hooks/partner/useActivePartner";
import { useLinkedPortfolioWallet } from "@/hooks/auth/useLinkedPortfolioWallet";
import { useUserAssets } from "@/hooks/portfolio/useUserAssets";
import { listVaultSubmissions } from "@/lib/core/api/vault-submissions";
import { listMyP2pOrders } from "@/lib/core/api/p2p";
import { postRwaVaultInfoBatch } from "@/lib/core/api/rwa-settlement";
import { rq } from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import { useAuthStore } from "@/store/authStore";
import {
  buildVaultHubRowsFromSubmissions,
  countVaultHubByState,
} from "@/lib/vault/buildVaultHubRows";
import { buildPartnerVaultHubRows } from "@/lib/vault/buildPartnerVaultHubRows";
import type { VaultHubRow, VaultHubVState } from "@/lib/vault/vaultHubTypes";
import { cn } from "@/lib/ds/cn";

type TabFilter = "all" | VaultHubVState;

const TABS: { id: TabFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "self", label: "Partner vault" },
  { id: "progress", label: "In progress" },
  { id: "done", label: "Added to portfolio" },
  { id: "rejected", label: "Rejected" },
];

function statusDotClass(kind: VaultHubRow["statusKind"]): string {
  if (kind === "action-needed") return "vault-status-dot--amber";
  if (kind === "in-transit" || kind === "reviewing" || kind === "minting") {
    return "vault-status-dot--azure";
  }
  if (kind === "rejected") return "vault-status-dot--neg";
  return "vault-status-dot--pos";
}

function statusLabelClass(kind: VaultHubRow["statusKind"]): string {
  if (kind === "action-needed") return "vault-ip-card__status-label--amber";
  if (kind === "in-transit" || kind === "reviewing" || kind === "minting") {
    return "vault-ip-card__status-label--azure";
  }
  if (kind === "rejected") return "vault-ip-card__status-label--neg";
  return "vault-ip-card__status-label--pos";
}

function HubIpCard({ item }: { item: VaultHubRow }) {
  return (
    <div
      className={cn(
        "vault-ip-card",
        item.actionNeeded && "vault-ip-card--action",
      )}
    >
      <div className="vault-ip-card__top">
        <div className="vault-ip-card__thumb">
          <VaultThumb src={item.imageUrl} width={56} height={78} />
          {item.cardCount > 1 ? (
            <span className="vault-ip-card__thumb-count" aria-hidden>
              {item.cardCount}
            </span>
          ) : null}
        </div>
        <div className="vault-ip-card__info">
          <div className="vault-ip-card__name-row">
            <div className="vault-ip-card__name">{item.name}</div>
            {item.cardCount > 1 ? (
              <span className="vault-ip-card__more">+{item.cardCount - 1} more</span>
            ) : null}
          </div>
          <div className="vault-ip-card__status">
            <span className={cn("vault-status-dot", statusDotClass(item.statusKind))} />
            <span
              className={cn(
                "vault-ip-card__status-label",
                statusLabelClass(item.statusKind),
              )}
            >
              {item.statusLabel}
            </span>
            {item.detail && item.trackingUrl ? (
              <a
                href={item.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mono vault-ip-card__tracking-link"
              >
                {item.detail} →
              </a>
            ) : item.detail ? (
              <span className="vault-ip-card__detail-text">{item.detail}</span>
            ) : null}
            <span
              className={cn(
                "vault-hub-grade-badge",
                item.gradeRejected && "vault-hub-grade-badge--rejected",
              )}
            >
              {item.grade}
            </span>
          </div>
        </div>
      </div>
      <div className="vault-ip-card__bottom">
        <Link
          href={item.cta.href}
          className={cn(
            "vault-hub-cta-link tk-btn tk-btn--sm",
            item.cta.primary ? "tk-btn--primary" : "tk-btn--subtle",
          )}
        >
          {item.cta.label} →
        </Link>
      </div>
    </div>
  );
}

/** Vault-Dashboard-Active.html `#view-active` — status tabs + ip-card list. */
export function VaultActiveDashboardView() {
  const { portfolioAddress } = useLinkedPortfolioWallet();
  const wallet = portfolioAddress?.trim() || "";
  const chainId = activeRqChainId();
  const { isActivePartner } = useActivePartner();
  const [filter, setFilter] = useState<TabFilter>("all");

  const submissionsQ = useQuery({
    queryKey: rq.vaultSubmissions(),
    queryFn: listVaultSubmissions,
    staleTime: 10_000,
  });

  const assets = useUserAssets(wallet || undefined, {
    enabled: Boolean(wallet) && isActivePartner,
    includeOrderHistory: false,
    includeMarketPreview: false,
    loadMarketOrders: true,
  });

  const vaultInfoQ = useQuery({
    queryKey: rq.rwaVaultInfoBatch(wallet, assets.loadedTokenIds, chainId),
    queryFn: () => postRwaVaultInfoBatch(assets.loadedTokenIds),
    enabled:
      isActivePartner && Boolean(wallet) && assets.loadedTokenIds.length > 0,
    staleTime: 60_000,
  });

  const p2pOrdersQ = useQuery({
    queryKey: ["p2p", "me", "orders", "seller", chainId],
    queryFn: () => listMyP2pOrders("seller"),
    enabled: isActivePartner,
    staleTime: 15_000,
  });

  const submissionRows = useMemo(
    () => buildVaultHubRowsFromSubmissions(submissionsQ.data ?? []),
    [submissionsQ.data],
  );

  const partnerRows = useMemo(() => {
    if (!isActivePartner || !wallet) return [] as VaultHubRow[];
    return buildPartnerVaultHubRows({
      assets: assets.assets,
      vaultInfo: vaultInfoQ.data?.items ?? [],
      activeOrders: assets.activeOrders,
      wallet,
      p2pSellerOrders: p2pOrdersQ.data ?? [],
    });
  }, [
    isActivePartner,
    wallet,
    assets.assets,
    assets.activeOrders,
    vaultInfoQ.data,
    p2pOrdersQ.data,
  ]);

  const allRows = useMemo(
    () => [...partnerRows, ...submissionRows],
    [partnerRows, submissionRows],
  );

  const counts = useMemo(() => countVaultHubByState(allRows), [allRows]);

  const visibleTabs = useMemo(
    () =>
      TABS.filter((t) => {
        if (t.id === "all" || t.id === "rejected") return true;
        if (t.id === "self" && !isActivePartner) return false;
        return counts[t.id] > 0;
      }),
    [counts, isActivePartner],
  );

  const effectiveFilter: TabFilter =
    visibleTabs.some((t) => t.id === filter) ? filter : "all";

  const selfVisible =
    isActivePartner &&
    partnerRows.length > 0 &&
    (effectiveFilter === "all" || effectiveFilter === "self");

  const psaRows = useMemo(() => {
    const list = submissionRows.filter((r) => r.vstate !== "self");
    if (effectiveFilter === "all") return list;
    if (effectiveFilter === "self") return [];
    return list.filter((r) => r.vstate === effectiveFilter);
  }, [submissionRows, effectiveFilter]);

  const selfFiltered =
    effectiveFilter === "all" || effectiveFilter === "self"
      ? partnerRows
      : [];

  const anyVisible = selfVisible || psaRows.length > 0;
  const loading = submissionsQ.isLoading;

  if (loading && allRows.length === 0) {
    return (
      <div className="vault-hub-active vault-hub-active--loading" aria-busy>
        <div className="vault-hub-active__skel" />
        <div className="vault-hub-active__skel" />
      </div>
    );
  }

  return (
    <div className="vault-hub-active">
      <div className="vault-vtabs" role="tablist" aria-label="Sell status">
        {visibleTabs.map((t) => {
          const on = effectiveFilter === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={cn("vault-vtab", on && "vault-vtab--on")}
              onClick={() => setFilter(t.id)}
            >
              {t.label}
              <span className="vault-vtab__n">{counts[t.id]}</span>
            </button>
          );
        })}
      </div>

      {selfVisible ? (
        <div className="vault-hub-block" data-vblock="self">
          <div className="vault-hub-block__head">
            <div className="vault-hub-block__title">
              Partner vault{" "}
              <span className="mono vault-hub-block__count">
                {partnerRows.length}{" "}
                {partnerRows.length === 1 ? "card" : "cards"}
              </span>
            </div>
            <span className="vault-hub-block__sub">
              Registered from your own vault — no shipping or review.
            </span>
          </div>
          <div className="vault-ip-grid">
            {selfFiltered.map((item) => (
              <HubIpCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ) : null}

      {psaRows.length > 0 ? (
        <div className="vault-hub-block" data-vblock="psa">
          <div className="vault-ip-grid">
            {psaRows.map((item) => (
              <HubIpCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ) : null}

      {!anyVisible ? (
        <div className="vault-hub-empty-filter">
          Nothing in this state right now.
        </div>
      ) : null}
    </div>
  );
}

/** True when the signed-in user has any Sell-hub activity (tabs + rows). */
export function useHasVaultHubActivity(): boolean {
  const user = useAuthStore((s) => s.user);
  const { portfolioAddress } = useLinkedPortfolioWallet();
  const wallet = portfolioAddress?.trim() || "";
  const { isActivePartner } = useActivePartner();
  const chainId = activeRqChainId();

  const submissionsQ = useQuery({
    queryKey: rq.vaultSubmissions(),
    queryFn: listVaultSubmissions,
    staleTime: 10_000,
    enabled: Boolean(user),
  });

  const assets = useUserAssets(wallet || undefined, {
    enabled: Boolean(wallet) && isActivePartner,
    includeOrderHistory: false,
    includeMarketPreview: false,
    loadMarketOrders: false,
  });

  const vaultInfoQ = useQuery({
    queryKey: rq.rwaVaultInfoBatch(wallet, assets.loadedTokenIds, chainId),
    queryFn: () => postRwaVaultInfoBatch(assets.loadedTokenIds),
    enabled:
      isActivePartner && Boolean(wallet) && assets.loadedTokenIds.length > 0,
    staleTime: 60_000,
  });

  const p2pOrdersQ = useQuery({
    queryKey: ["p2p", "me", "orders", "seller", chainId],
    queryFn: () => listMyP2pOrders("seller"),
    enabled: isActivePartner && Boolean(user),
    staleTime: 15_000,
  });

  return useMemo(() => {
    const fromSubs = buildVaultHubRowsFromSubmissions(submissionsQ.data ?? []);
    if (fromSubs.length > 0) return true;
    if (!isActivePartner || !wallet) return false;
    const partner = buildPartnerVaultHubRows({
      assets: assets.assets,
      vaultInfo: vaultInfoQ.data?.items ?? [],
      activeOrders: [],
      wallet,
      p2pSellerOrders: p2pOrdersQ.data ?? [],
    });
    return partner.length > 0;
  }, [
    submissionsQ.data,
    isActivePartner,
    wallet,
    assets.assets,
    vaultInfoQ.data,
    p2pOrdersQ.data,
  ]);
}
