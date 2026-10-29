"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { VaultThumb } from "@/components/vault/VaultThumb";
import { ASSETS } from "@/constants/assets";
import { useVaultSubmissionDisplayByCert } from "@/hooks/vault/useVaultSubmissionDisplayByCert";
import {
  cancelVaultSubmission,
  listVaultSubmissions,
} from "@/lib/core/api/vault-submissions";
import { rq } from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import {
  clearAllSellLocalState,
  readSellSubmissionPublicId,
} from "@/lib/sell/sellFlowDraft";
import { useAuthStore } from "@/store/authStore";
import {
  buildVaultHubPackages,
  countVaultHubPackages,
  packageMatchesTab,
  type VaultHubPackage,
} from "@/lib/vault/buildVaultHubRows";
import type { VaultHubVState } from "@/lib/vault/vaultHubTypes";
import { useCatalogNameRevision } from "@/lib/marketplace/catalogNameTranslation";
import { cn } from "@/lib/ds/cn";

type TabFilter = "all" | VaultHubVState;

const ACTION_KEYS = {
  "Arrange return": "arrangeReturn",
  "File a claim": "fileClaim",
  "Track shipment": "trackShipment",
  "View details": "viewDetails",
  View: "view",
  "Add tracking": "addTracking",
  "Track →": "trackArrow",
  "Contact support": "contactSupport",
} as const;

function vaultDashImage(src: string): string {
  return src.trim() || ASSETS.icons.tokenableMintPlaceholder;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points={open ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
    </svg>
  );
}

function PackageAction({ pkg }: { pkg: VaultHubPackage }) {
  const t = useTranslations("Sell");
  const actionKey = ACTION_KEYS[pkg.actionLabel as keyof typeof ACTION_KEYS];
  const label = actionKey ? t(actionKey) : pkg.actionLabel;
  const className = cn(
    "vault-dash-btn",
    pkg.actionTone === "primary" ? "vault-dash-btn--primary" : "vault-dash-btn--subtle",
  );
  if (pkg.actionExternal || pkg.actionHref.startsWith("mailto:")) {
    return (
      <a
        href={pkg.actionHref}
        className={className}
        {...(pkg.actionExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {label}
      </a>
    );
  }
  return (
    <Link href={pkg.actionHref} className={className}>
      {label}
    </Link>
  );
}

function PackageRow({
  pkg,
  open,
  onToggle,
  onCancel,
  cancelling,
}: {
  pkg: VaultHubPackage;
  open: boolean;
  onToggle: () => void;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  const t = useTranslations("Sell");
  const units = useTranslations("RedeemUi");
  const pill: Record<VaultHubVState, string> = {
    pending: t("shipPending"),
    transit: t("shipped"),
    verify: t("verifying"),
    vaulted: t("vaulted"),
    reject: t("rejected"),
  };
  const shown = pkg.cards.slice(0, 4);
  const more = pkg.cards.length - shown.length;

  return (
    <article
      className={cn("vault-dash-sb", `vault-dash-sb--${pkg.status}`, open && "vault-dash-sb--open")}
    >
      <span className="vault-dash-stack" aria-hidden>
        {pkg.cards.slice(0, 3).map((card, i) => (
          <span key={card.id} className="vault-dash-stack__slot" style={{ "--i": i } as CSSProperties}>
            <VaultThumb src={vaultDashImage(card.imageUrl)} width={44} height={64} className="vault-dash-stack__img" alt="" />
          </span>
        ))}
      </span>
      <div className="vault-dash-sb__t">
        <div className="vault-dash-sb__title">{pkg.title}</div>
        {pkg.cards.length > 1 && pkg.status !== "pending" && pkg.status !== "transit" ? <div className="vault-dash-sb__meta">{pkg.meta}</div> : null}
        {pkg.vaultedCount > 0 || pkg.rejectedCount > 0 ? (
          <div className="vault-dash-sum">
            {pkg.vaultedCount > 0 ? (
              <span>
                <b>{pkg.vaultedCount}</b> {t("vaultedWord")}
              </span>
            ) : null}
            {pkg.vaultedCount > 0 && pkg.rejectedCount > 0 ? <span> · </span> : null}
            {pkg.rejectedCount > 0 ? (
              <span>
                <b className="vault-dash-sum__neg">{pkg.rejectedCount}</b> {t("rejectedWord")}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <span className={cn("vault-dash-pill", `vault-dash-pill--${pkg.status}`)}>{pill[pkg.status]}</span>
      <div className="vault-dash-bot">
        <button type="button" className="vault-dash-tog" aria-expanded={open} onClick={onToggle}>
          <span className="vault-dash-mono">({pkg.cards.length})</span>{" "}
          {units(pkg.cards.length === 1 ? "cardOne" : "cardMany")} <Chevron open={open} />
        </button>
        <div className="vault-dash-eta">
          {pkg.status === "pending" ? <span>-</span> : null}
          {(pkg.status === "pending" ? [] : pkg.eta.filter(Boolean)).map((part, i, parts) => {
            const isCarrierLine =
              Boolean(pkg.trackingUrl) && pkg.status === "transit" && i === parts.length - 1;
            if (isCarrierLine && pkg.trackingUrl) {
              return (
                <a
                  key={part}
                  href={pkg.trackingUrl}
                  className="vault-dash-eta__track"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {part}
                </a>
              );
            }
            return <span key={part}>{part}</span>;
          })}
        </div>
        <div className="vault-dash-act">
          {pkg.canCancel && onCancel ? (
            <button
              type="button"
              className="vault-dash-btn vault-dash-btn--subtle"
              disabled={cancelling}
              onClick={onCancel}
            >
              {cancelling ? t("removing") : t("remove")}
            </button>
          ) : null}
          <PackageAction pkg={pkg} />
        </div>
      </div>
      {open && pkg.cards.length > 0 ? (
        <div className="vault-dash-list">
          {shown.map((card) => (
            <div key={card.id} className="vault-dash-c">
              <VaultThumb src={vaultDashImage(card.imageUrl)} width={28} height={40} className="vault-dash-c__img" alt="" />
              <span className="vault-dash-c__name">
                {card.title}
                {pkg.cards.length === 1 && card.detail ? (
                  <span className="vault-dash-c__detail">{card.detail}</span>
                ) : null}
              </span>
              <span className="vault-dash-c__cert">{card.cert ? `Cert #${card.cert}` : ""}</span>
              <span className={cn("vault-dash-c__st", `vault-dash-c__st--${card.state}`)}>{card.statusLabel}</span>
            </div>
          ))}
          {more > 0 ? (
            <Link href={pkg.detailHref} className="vault-dash-more">
              {t("moreCards", { more, count: pkg.cards.length })}
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function VaultHubActivityLoading() {
  return (
    <div className="vault-dash vault-dash--loading" aria-busy>
      <div className="vault-dash-skel" />
      <div className="vault-dash-skel" />
    </div>
  );
}

/** Vault-Dashboard-Active.html — status tabs + submission rows. */
export function VaultActiveDashboardView() {
  const t = useTranslations("Sell");
  const locale = useLocale();
  const catalogNames = useCatalogNameRevision();
  const [filter, setFilter] = useState<TabFilter>("all");
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();
  const submissionsQ = useVaultHubSubmissions();
  const submissions = submissionsQ.data ?? [];
  const submissionItems = useMemo(
    () => submissions.flatMap((s) => s.items),
    [submissions],
  );
  const displayByCert = useVaultSubmissionDisplayByCert(submissionItems);
  const packages = useMemo(
    () => buildVaultHubPackages(submissions, displayByCert),
    [submissions, displayByCert, locale, catalogNames],
  );
  const tabs: { id: TabFilter; label: string }[] = [
    { id: "all", label: t("all") },
    { id: "pending", label: t("shipPending") },
    { id: "transit", label: t("shipped") },
    { id: "verify", label: t("verifying") },
    { id: "vaulted", label: t("vaulted") },
    { id: "reject", label: t("rejected") },
  ];
  const counts = useMemo(() => countVaultHubPackages(packages), [packages]);
  const visible = packages.filter((pkg) => packageMatchesTab(pkg, filter));

  const cancelMut = useMutation({
    mutationFn: (publicId: string) => cancelVaultSubmission(publicId),
    onSuccess: (_data, publicId) => {
      if (readSellSubmissionPublicId() === publicId) {
        clearAllSellLocalState();
      }
      void queryClient.invalidateQueries({
        queryKey: rq.vaultSubmissions(activeRqChainId()),
      });
    },
  });

  if (submissionsQ.isPending && packages.length === 0) {
    return <VaultHubActivityLoading />;
  }

  return (
    <div className="vault-dash">
      <div className="vault-dash-tabs" role="tablist" aria-label={t("vaultingStatus")}>
        {tabs.map((tab) => {
          const on = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={cn("vault-dash-tab", on && "vault-dash-tab--on")}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label} <span className="vault-dash-tab__n">{counts[tab.id]}</span>
            </button>
          );
        })}
      </div>
      {visible.length > 0 ? (
        <div className="vault-dash-list-wrap">
          {visible.map((pkg) => (
            <PackageRow
              key={pkg.id}
              pkg={pkg}
              open={Boolean(openIds[pkg.id])}
              onToggle={() => setOpenIds((prev) => ({ ...prev, [pkg.id]: !prev[pkg.id] }))}
              onCancel={
                pkg.canCancel
                  ? () => {
                      if (
                        !window.confirm(
                          t("removeConfirm"),
                        )
                      ) {
                        return;
                      }
                      cancelMut.mutate(pkg.id);
                    }
                  : undefined
              }
              cancelling={cancelMut.isPending && cancelMut.variables === pkg.id}
            />
          ))}
        </div>
      ) : (
        <div className="vault-dash-empty">{t("emptyState")}</div>
      )}
    </div>
  );
}

export function useVaultHubSubmissions() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: rq.vaultSubmissions(activeRqChainId()),
    queryFn: listVaultSubmissions,
    staleTime: 10_000,
    enabled: Boolean(user),
  });
}

export type VaultHubViewState = "loading" | "empty" | "active";

export function useVaultHubViewState(): VaultHubViewState {
  const submissionsQ = useVaultHubSubmissions();

  if (submissionsQ.isPending) return "loading";

  return (submissionsQ.data ?? []).some((s) => s.status !== "cancelled" && s.status !== "draft")
    ? "active"
    : "empty";
}

/** True when the signed-in user has any PSA vaulting activity on this hub. */
export function useHasVaultHubActivity(): boolean {
  return useVaultHubViewState() === "active";
}
