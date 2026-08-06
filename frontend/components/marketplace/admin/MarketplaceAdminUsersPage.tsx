"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdminUserAccountStatusFilter,
  AdminUserFilter,
  AdminUserRoleFilter,
  AdminUserSummary,
} from "@/lib/core";
import {
  formatAdminJoinDate,
  formatAdminUserEmail,
  formatAdminUserShortId,
  formatKycStatus,
  userInitials,
} from "@/lib/core/api/marketplace-admin-users";
import {
  ADMIN_USERS_PAGE_SIZE,
  useMarketplaceAdminUsers,
} from "@/hooks/marketplace-admin/useMarketplaceAdminUsers";
import {
  ADMIN_BTN_LOAD_MORE,
  ADMIN_BTN_PRIMARY,
  ADMIN_COUNT,
  ADMIN_INPUT,
  ADMIN_PAGE_SUBTITLE,
  ADMIN_PAGE_TITLE,
  ADMIN_SEGMENT,
  ADMIN_SEGMENT_BTN,
  ADMIN_SEGMENT_BTN_ACTIVE,
  ADMIN_TABLE,
  ADMIN_TABLE_HEAD,
  ADMIN_TABLE_TD,
  ADMIN_TABLE_TH,
  ADMIN_TABLE_WRAP,
  ADMIN_TEXT_EMPTY,
  ADMIN_TEXT_META,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";

type ListTab = "all" | "flagged";

const KYC_FILTERS: { value: AdminUserFilter; label: string }[] = [
  { value: "all", label: "전체 KYC" },
  { value: "kyc_none", label: "해당 없음" },
  { value: "kyc_approved", label: "검수 통과" },
  { value: "kyc_pending", label: "심사 중" },
  { value: "kyc_rejected", label: "실패" },
];

const STATUS_FILTERS: {
  value: AdminUserAccountStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "전체 상태" },
  { value: "active", label: "활성" },
  { value: "restricted", label: "제한" },
  { value: "suspended", label: "정지" },
];

const ROLE_FILTERS: {
  value: AdminUserRoleFilter | null;
  label: string;
}[] = [
  { value: null, label: "전체 역할" },
  { value: "partner", label: "파트너" },
  { value: "individual", label: "개인 유저" },
];

function kycDotClass(status: AdminUserSummary["kycStatus"]): string {
  if (status === "approved") return "bg-emerald-500";
  if (status === "pending") return "bg-sky-500";
  if (status === "rejected") return "bg-amber-500";
  return "bg-zinc-400";
}

function StrikeDots({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${count}/3`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            i < count
              ? count >= 3
                ? "bg-red-500"
                : "bg-sky-500"
              : "bg-zinc-300"
          }`}
        />
      ))}
      <span className={`ml-1.5 text-xs ${ADMIN_TEXT_META}`}>{count}/3</span>
    </span>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? ADMIN_SEGMENT_BTN_ACTIVE : ADMIN_SEGMENT_BTN}
    >
      {label}
    </button>
  );
}

export function MarketplaceAdminUsersPage() {
  const router = useRouter();
  const [tab, setTab] = useState<ListTab>("all");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [kycFilter, setKycFilter] = useState<AdminUserFilter>("all");
  const [accountStatus, setAccountStatus] =
    useState<AdminUserAccountStatusFilter>("all");
  const [role, setRole] = useState<AdminUserRoleFilter | null>(null);
  const [page, setPage] = useState(1);

  const { listQuery } = useMarketplaceAdminUsers({
    q: search,
    filter: kycFilter,
    role,
    accountStatus,
    page,
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const hasMore = listQuery.data?.hasMore ?? false;

  const tabHrefNote = useMemo(
    () => (tab === "flagged" ? "준비 중 — 스트라이크·제한 스키마 미구현" : null),
    [tab],
  );

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
        aria-label="유저 탭"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "all"}
          className={`relative -mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
            tab === "all"
              ? "border-[var(--brand-500)] text-zinc-900"
              : "border-transparent text-zinc-600 hover:text-zinc-900"
          }`}
          onClick={() => setTab("all")}
        >
          전체 유저
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "flagged"}
          className={`relative -mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
            tab === "flagged"
              ? "border-[var(--brand-500)] text-zinc-900"
              : "border-transparent text-zinc-600 hover:text-zinc-900"
          }`}
          onClick={() => setTab("flagged")}
        >
          플래그 / 제한
          <span className="rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700">
            0
          </span>
        </button>
      </div>

      {tab === "flagged" ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
          <p className={`text-sm font-medium text-zinc-800`}>
            플래그 / 제한 목록은 준비 중입니다
          </p>
          <p className={`mt-2 text-sm ${ADMIN_TEXT_SECONDARY}`}>
            스트라이크·계정 제한·판매 정지 스키마가 아직 없습니다. 상세의 해당
            버튼도 동일하게 안내합니다.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <div className={ADMIN_SEGMENT} role="group" aria-label="KYC">
                {KYC_FILTERS.map((f) => (
                  <FilterChip
                    key={f.value}
                    active={kycFilter === f.value}
                    label={f.label}
                    onClick={() => {
                      setKycFilter(f.value);
                      setPage(1);
                    }}
                  />
                ))}
              </div>
              <div className={ADMIN_SEGMENT} role="group" aria-label="상태">
                {STATUS_FILTERS.map((f) => (
                  <FilterChip
                    key={f.value}
                    active={accountStatus === f.value}
                    label={f.label}
                    onClick={() => {
                      setAccountStatus(f.value);
                      setPage(1);
                    }}
                  />
                ))}
              </div>
              <div className={ADMIN_SEGMENT} role="group" aria-label="역할">
                {ROLE_FILTERS.map((f) => (
                  <FilterChip
                    key={f.label}
                    active={role === f.value}
                    label={f.label}
                    onClick={() => {
                      setRole(f.value);
                      setPage(1);
                    }}
                  />
                ))}
              </div>
            </div>
            <form
              className="flex min-w-0 flex-1 gap-2 lg:max-w-sm lg:justify-end"
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(q.trim());
                setPage(1);
              }}
            >
              <input
                className={ADMIN_INPUT}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="이름·이메일·유저 ID"
                aria-label="유저 검색"
              />
              <button type="submit" className={ADMIN_BTN_PRIMARY}>
                검색
              </button>
            </form>
          </div>

          {tabHrefNote ? (
            <p className={`mb-3 text-sm ${ADMIN_TEXT_SECONDARY}`}>{tabHrefNote}</p>
          ) : null}

          <p className={`${ADMIN_COUNT} mb-3`}>
            {listQuery.isLoading ? "…" : `${total.toLocaleString()}명`}
          </p>

          {listQuery.isError ? (
            <p className="text-sm text-red-600" role="alert">
              {listQuery.error instanceof Error
                ? listQuery.error.message
                : "목록을 불러오지 못했습니다"}
            </p>
          ) : null}

          <div className={ADMIN_TABLE_WRAP}>
            <table className={ADMIN_TABLE}>
              <thead className={ADMIN_TABLE_HEAD}>
                <tr>
                  <th className={ADMIN_TABLE_TH}>유저</th>
                  <th className={ADMIN_TABLE_TH}>역할</th>
                  <th className={ADMIN_TABLE_TH}>KYC</th>
                  <th className={ADMIN_TABLE_TH}>가입일</th>
                  <th className={`${ADMIN_TABLE_TH} text-right`}>보관 카드</th>
                  <th className={ADMIN_TABLE_TH}>스트라이크</th>
                  <th className={ADMIN_TABLE_TH}>상태</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && !listQuery.isLoading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className={`${ADMIN_TABLE_TD} py-10 text-center ${ADMIN_TEXT_EMPTY}`}
                    >
                      유저가 없습니다
                    </td>
                  </tr>
                ) : null}
                {items.map((row) => {
                  const shortId = formatAdminUserShortId(row.id);
                  const displayName =
                    row.name?.trim() || formatAdminUserEmail(row.email);
                  const isActivePartner = Boolean(row.partner?.isActive);
                  return (
                    <tr
                      key={row.id}
                      className="cursor-pointer transition-colors hover:bg-zinc-50"
                      onClick={() =>
                        router.push(`/marketplace/admin/users/${row.id}`)
                      }
                    >
                      <td className={ADMIN_TABLE_TD}>
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700"
                            aria-hidden
                          >
                            {userInitials(row.name, row.email)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-zinc-900">
                              {displayName}
                            </p>
                            <p className={`truncate text-xs ${ADMIN_TEXT_META}`}>
                              {formatAdminUserEmail(row.email)}
                              {!row.name?.trim() ? (
                                <span className="text-zinc-400"> · {shortId}</span>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={ADMIN_TABLE_TD}>
                        {isActivePartner ? (
                          <div>
                            <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 ring-1 ring-sky-200">
                              파트너
                            </span>
                            <p className={`mt-1 text-xs ${ADMIN_TEXT_META}`}>
                              {row.partner?.displayName}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-700">개인 유저</span>
                        )}
                      </td>
                      <td className={ADMIN_TABLE_TD}>
                        <span className="inline-flex items-center gap-1.5 text-sm text-zinc-800">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${kycDotClass(row.kycStatus)}`}
                          />
                          {formatKycStatus(row.kycStatus)}
                        </span>
                      </td>
                      <td className={`${ADMIN_TABLE_TD} tabular-nums`}>
                        {formatAdminJoinDate(row.createdAt)}
                      </td>
                      <td
                        className={`${ADMIN_TABLE_TD} text-right tabular-nums`}
                      >
                        {row.custodyCardCount}
                      </td>
                      <td className={ADMIN_TABLE_TD}>
                        <StrikeDots count={row.strikeCount ?? 0} />
                      </td>
                      <td className={ADMIN_TABLE_TD}>
                        <span className="inline-flex items-center gap-1.5 text-sm text-zinc-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          활성
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>
              Page {page}
              {total > 0
                ? ` · ${(
                    (page - 1) * ADMIN_USERS_PAGE_SIZE +
                    1
                  ).toLocaleString()}–${Math.min(
                    page * ADMIN_USERS_PAGE_SIZE,
                    total,
                  ).toLocaleString()}`
                : null}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={ADMIN_BTN_LOAD_MORE}
                style={{ width: "auto", paddingInline: "1rem" }}
                disabled={page <= 1 || listQuery.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                이전
              </button>
              <button
                type="button"
                className={ADMIN_BTN_LOAD_MORE}
                style={{ width: "auto", paddingInline: "1rem" }}
                disabled={!hasMore || listQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                다음
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
