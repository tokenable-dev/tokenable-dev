"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  formatAdminJoinDate,
  formatAdminUserEmail,
  formatAdminUserShortId,
  patchAdminMarketplacePartner,
  postAdminMarketplacePartner,
  rq,
  userInitials,
} from "@/lib/core";
import {
  useMarketplaceAdminUserDetail,
  useMarketplaceAdminUsers,
} from "@/hooks/marketplace-admin/useMarketplaceAdminUsers";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_SECONDARY,
  ADMIN_PAGE_SUBTITLE,
  ADMIN_PAGE_TITLE,
  ADMIN_PANEL,
  ADMIN_TEXT_META,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";
import { MarketplaceAdminPartnerApproveModal } from "./MarketplaceAdminPartnerApproveModal";
import { MarketplaceAdminUserManagePanel } from "./MarketplaceAdminUserRow";

function comingSoon() {
  window.alert("준비 중입니다. 스트라이크·계정 제한·판매 정지는 아직 백엔드에 없습니다.");
}

function primaryWallet(detail: {
  wallets: { walletAddress: string; isPrimary: boolean }[];
  walletAddress: string | null;
}): string | null {
  return (
    detail.wallets.find((w) => w.isPrimary)?.walletAddress ??
    detail.wallets[0]?.walletAddress ??
    detail.walletAddress ??
    null
  );
}

export function MarketplaceAdminUserDetailPage({ userId }: { userId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const detailQuery = useMarketplaceAdminUserDetail(userId, true);
  const { patchMutation, deleteMutation, actionMutation } =
    useMarketplaceAdminUsers({
      q: "",
      filter: "all",
      page: 1,
    });

  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [partnerBusy, setPartnerBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const detail = detailQuery.data;
  const shortId = formatAdminUserShortId(userId);
  const displayName = detail
    ? detail.name?.trim() || formatAdminUserEmail(detail.email)
    : shortId;
  const activePartner = detail?.partner?.isActive ? detail.partner : null;
  const inactivePartner =
    detail?.partner && !detail.partner.isActive ? detail.partner : null;

  const custodyPreview = useMemo(() => {
    const n = detail?.custodyCardCount ?? 0;
    const shown = Math.min(8, n);
    return { shown, more: Math.max(0, n - shown), total: n };
  }, [detail?.custodyCardCount]);

  const partnerMutation = useMutation({
    mutationFn: async (input: {
      mode: "create" | "reactivate" | "revoke";
      displayName?: string;
      walletAddress?: string;
      partnerId?: string;
    }) => {
      if (input.mode === "revoke") {
        if (!input.partnerId) throw new Error("Partner id required");
        return patchAdminMarketplacePartner(input.partnerId, {
          isActive: false,
        });
      }
      if (input.mode === "reactivate") {
        if (!input.partnerId) throw new Error("Partner id required");
        return patchAdminMarketplacePartner(input.partnerId, {
          isActive: true,
          displayName: input.displayName,
        });
      }
      if (!input.displayName?.trim() || !input.walletAddress?.trim()) {
        throw new Error("displayName and wallet required");
      }
      return postAdminMarketplacePartner({
        displayName: input.displayName.trim(),
        walletAddress: input.walletAddress.trim(),
        isActive: true,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: rq.adminUserDetail(userId) });
      await qc.invalidateQueries({ queryKey: ["admin-users-list"] });
      await qc.invalidateQueries({ queryKey: rq.adminMarketplacePartners });
    },
  });

  const busy =
    patchMutation.isPending ||
    deleteMutation.isPending ||
    actionMutation.isPending ||
    partnerBusy;

  const onApprovePartner = async (input: {
    displayName: string;
    walletAddress: string;
  }) => {
    setPartnerBusy(true);
    setActionMsg(null);
    try {
      if (inactivePartner) {
        await partnerMutation.mutateAsync({
          mode: "reactivate",
          partnerId: inactivePartner.id,
          displayName: input.displayName,
        });
      } else {
        await partnerMutation.mutateAsync({
          mode: "create",
          displayName: input.displayName,
          walletAddress: input.walletAddress,
        });
      }
      setPartnerModalOpen(false);
      setActionMsg("파트너로 승인되었습니다");
    } finally {
      setPartnerBusy(false);
    }
  };

  const onRevokePartner = async () => {
    if (!activePartner) return;
    if (
      !window.confirm(
        `${activePartner.displayName} 파트너를 해제할까요? (self vault 자격 상실)`,
      )
    ) {
      return;
    }
    setPartnerBusy(true);
    setActionMsg(null);
    try {
      await partnerMutation.mutateAsync({
        mode: "revoke",
        partnerId: activePartner.id,
      });
      setActionMsg("파트너가 해제되었습니다");
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "해제 실패");
    } finally {
      setPartnerBusy(false);
    }
  };

  return (
    <div>
      <header className="mb-5 sm:mb-6">
        <h1 className={ADMIN_PAGE_TITLE}>유저</h1>
        <p className={ADMIN_PAGE_SUBTITLE}>
          Sumsub 셀러 인증 상태와 정책 위반 셀러
        </p>
      </header>

      <div
        className="mb-5 flex gap-1 border-b border-zinc-200 sm:mb-6"
        role="tablist"
      >
        <Link
          href="/marketplace/admin/users"
          className="relative -mb-px border-b-2 border-[var(--brand-500)] px-3 py-2.5 text-sm font-medium text-zinc-900"
        >
          전체 유저
        </Link>
        <Link
          href="/marketplace/admin/users"
          className="relative -mb-px inline-flex items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          플래그 / 제한
          <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700">
            0
          </span>
        </Link>
      </div>

      <nav className="mb-4">
        <Link
          href="/marketplace/admin/users"
          className={`inline-flex items-center gap-1 text-sm font-medium ${ADMIN_TEXT_SECONDARY} hover:text-zinc-900`}
        >
          ← 유저 / {shortId}
        </Link>
      </nav>

      {detailQuery.isLoading ? (
        <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>불러오는 중…</p>
      ) : null}
      {detailQuery.isError ? (
        <p className="text-sm text-red-600" role="alert">
          {detailQuery.error instanceof Error
            ? detailQuery.error.message
            : "유저를 불러오지 못했습니다"}
        </p>
      ) : null}

      {detail ? (
        <>
          <section className={`${ADMIN_PANEL} p-5 sm:p-6`}>
            <div className="flex flex-wrap items-start gap-4">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-base font-semibold text-zinc-700"
                aria-hidden
              >
                {userInitials(detail.name, detail.email)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-zinc-900 sm:text-xl">
                    {displayName}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    활성
                  </span>
                  {activePartner ? (
                    <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 ring-1 ring-sky-200">
                      파트너 · {activePartner.displayName}
                    </span>
                  ) : null}
                </div>
                <p className={`mt-1 text-sm ${ADMIN_TEXT_MUTED}`}>
                  {formatAdminUserEmail(detail.email)} · {shortId} · 가입{" "}
                  {formatAdminJoinDate(detail.createdAt)}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {activePartner ? (
                <button
                  type="button"
                  className={ADMIN_BTN_SECONDARY}
                  disabled={busy}
                  onClick={() => void onRevokePartner()}
                >
                  파트너 해제
                </button>
              ) : (
                <button
                  type="button"
                  className={ADMIN_BTN_SECONDARY}
                  disabled={busy}
                  onClick={() => setPartnerModalOpen(true)}
                >
                  파트너 승인
                </button>
              )}
              <button
                type="button"
                className={ADMIN_BTN_SECONDARY}
                onClick={comingSoon}
              >
                스트라이크 추가
              </button>
              <button
                type="button"
                className={ADMIN_BTN_SECONDARY}
                onClick={comingSoon}
              >
                계정 제한
              </button>
              <button
                type="button"
                className={ADMIN_BTN_SECONDARY}
                onClick={comingSoon}
              >
                판매 정지
              </button>
            </div>
            {actionMsg ? (
              <p className={`mt-3 text-sm ${ADMIN_TEXT_SECONDARY}`}>{actionMsg}</p>
            ) : null}
          </section>

          <section className="mt-5">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900">활동</h3>
            <div
              className={`${ADMIN_PANEL} grid divide-y divide-zinc-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0`}
            >
              {(
                [
                  { label: "제출", value: "—", hint: "준비 중" },
                  { label: "리스팅", value: "—", hint: "준비 중" },
                  { label: "구매 / 입찰", value: "—", hint: "준비 중" },
                ] as const
              ).map((cell) => (
                <div key={cell.label} className="px-5 py-4">
                  <p className={`text-xs font-medium ${ADMIN_TEXT_META}`}>
                    {cell.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">
                    {cell.value}
                  </p>
                  <span
                    className={`mt-2 inline-block text-sm font-medium text-zinc-400`}
                    title={cell.hint}
                  >
                    보기 →
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900">
              보관 카드 ({custodyPreview.total})
            </h3>
            <div className={`${ADMIN_ARTICLE} flex flex-wrap items-center gap-2`}>
              {custodyPreview.total === 0 ? (
                <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>
                  민팅된 보관 카드가 없습니다
                </p>
              ) : (
                <>
                  {Array.from({ length: custodyPreview.shown }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 w-11 rounded-md border border-zinc-200 bg-zinc-100 sm:h-20 sm:w-14"
                      aria-hidden
                    />
                  ))}
                  {custodyPreview.more > 0 ? (
                    <span className={`ml-1 text-sm ${ADMIN_TEXT_MUTED}`}>
                      + {custodyPreview.more} more
                    </span>
                  ) : null}
                </>
              )}
            </div>
          </section>

          <div className="mt-6">
            <MarketplaceAdminUserManagePanel
              detail={detail}
              busy={busy}
              onAction={async (input) => {
                await actionMutation.mutateAsync(input);
              }}
              onPatchName={async (id, name) => {
                await patchMutation.mutateAsync({
                  userId: id,
                  body: { name: name.trim() || null },
                });
              }}
              onDelete={async (id) => {
                await deleteMutation.mutateAsync(id);
                router.push("/marketplace/admin/users");
              }}
            />
          </div>

          <MarketplaceAdminPartnerApproveModal
            open={partnerModalOpen}
            userLabel={`${displayName} · ${shortId}`}
            initialDisplayName={
              inactivePartner?.displayName || detail.name || ""
            }
            initialWalletAddress={
              inactivePartner?.walletAddress || primaryWallet(detail)
            }
            busy={partnerBusy}
            onClose={() => setPartnerModalOpen(false)}
            onSubmit={onApprovePartner}
          />
        </>
      ) : null}
    </div>
  );
}
