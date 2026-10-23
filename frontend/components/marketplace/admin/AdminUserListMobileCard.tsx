"use client";

import type { AdminUserSummary } from "@/lib/core";
import {
  formatAdminJoinDate,
  formatAdminUserEmail,
  formatAdminUserShortId,
  formatKycStatus,
  userInitials,
} from "@/lib/core/api/marketplace-admin-users";
import { ADMIN_TEXT_META } from "./adminUi";

function kycDotClass(status: AdminUserSummary["kycStatus"]): string {
  if (status === "approved") return "bg-emerald-500";
  if (status === "pending") return "bg-sky-500";
  if (status === "rejected") return "bg-amber-500";
  return "bg-zinc-400";
}

function StrikeDots({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`스트라이크 ${count}/3`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${
            i < count
              ? count >= 3
                ? "bg-red-500"
                : "bg-sky-500"
              : "bg-zinc-300"
          }`}
        />
      ))}
      <span className={`ml-1 text-[11px] ${ADMIN_TEXT_META}`}>{count}/3</span>
    </span>
  );
}

export function AdminUserListMobileCard({
  row,
  onOpen,
}: {
  row: AdminUserSummary;
  onOpen: () => void;
}) {
  const shortId = formatAdminUserShortId(row.id);
  const displayName = row.name?.trim() || formatAdminUserEmail(row.email);
  const isActivePartner = Boolean(row.partner?.isActive);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-sm transition-colors active:bg-zinc-50"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700"
        aria-hidden
      >
        {userInitials(row.name, row.email)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-zinc-900">{displayName}</p>
        <p className={`truncate text-xs ${ADMIN_TEXT_META}`}>
          {row.name?.trim()
            ? formatAdminUserEmail(row.email)
            : `${formatAdminUserEmail(row.email)} · ${shortId}`}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-800">
            <span
              className={`h-1.5 w-1.5 rounded-full ${kycDotClass(row.kycStatus)}`}
            />
            {formatKycStatus(row.kycStatus)}
          </span>
          {isActivePartner ? (
            <span className="inline-flex max-w-full truncate rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800 ring-1 ring-sky-200">
              파트너 · {row.partner?.displayName}
            </span>
          ) : (
            <span className={`text-[11px] ${ADMIN_TEXT_META}`}>개인</span>
          )}
          <span className={`text-[11px] ${ADMIN_TEXT_META}`}>
            보관 {row.custodyCardCount}
          </span>
          <StrikeDots count={row.strikeCount ?? 0} />
        </div>
        <p className={`mt-1.5 text-[11px] ${ADMIN_TEXT_META}`}>
          가입 {formatAdminJoinDate(row.createdAt)} · 활성
        </p>
      </div>
      <span className="shrink-0 self-center text-zinc-400" aria-hidden>
        ›
      </span>
    </button>
  );
}
