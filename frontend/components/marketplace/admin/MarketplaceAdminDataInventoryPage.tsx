"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  useMarketplaceAdminDataInventory,
  useMarketplaceAdminDataInventoryRows,
  useMarketplaceAdminResetForNewContract,
} from "@/hooks/marketplace-admin/useMarketplaceAdminDataInventory";
import type {
  DataInventoryDomainId,
  DataStoreInventoryRow,
} from "@/lib/core/api/marketplace-admin-data-inventory";
import { AdminSectionTitle } from "./AdminAnalyticsWidgets";
import {
  ADMIN_ARTICLE,
  ADMIN_BTN_DANGER,
  ADMIN_LINK,
  ADMIN_PANEL,
  ADMIN_TEXT_META,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";
import { AdminDataInventorySchemaMap } from "./AdminDataInventorySchemaMap";

type GlanceKey = "stores" | "total" | "catalog" | "markets" | "other";

const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR");
}

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const HIGHLIGHT_LABELS: Record<string, string> = {
  burnedCount: "번된 토큰 수",
  activeCount: "활성 주문 수",
  fulfilledCount: "체결 주문 수",
  liveCount: "라이브 컬렉션",
  pendingReview: "리뷰 대기",
  snapshotStateFresh: "시세 신선",
  snapshotStateStale: "시세 오래됨",
  openJobs: "진행 중 벌크 잡",
  approvedKyc: "KYC 승인",
  openCycles: "열린 볼트 사이클",
};

function formatHighlightKey(key: string): string {
  return (
    HIGHLIGHT_LABELS[key] ??
    key
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase())
  );
}

const STALE_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

/** Wired product tables — empty does not mean drop. */
const KEEP_IF_EMPTY = new Set([
  "p2p_listings",
  "p2p_orders",
  "self_vault_settlements",
  "cardhedger_price_subscriptions",
  "cardhedger_daily_price_export_runs",
  "cardhedger_price_delta_checkpoints",
  "cardhedger_price_delta_import_runs",
  "vault_psa_arrival_reviews",
  "vault_psa_vaulted_reviews",
  "user_buyer_listing_alert",
  "marketplace_notifications",
  "rwa_owner_index_cursors",
]);

function storeStaleReason(store: DataStoreInventoryRow): string | null {
  if (store.rowCount === 0) return "empty";
  if (!store.lastActivityAt) return null;
  const t = new Date(store.lastActivityAt).getTime();
  if (Number.isNaN(t)) return null;
  if (Date.now() - t >= STALE_AFTER_MS) return "stale90";
  return null;
}

function highlightEntries(
  highlights: DataStoreInventoryRow["highlights"],
): [string, string | number | boolean | null][] {
  return Object.entries(highlights).filter(([, v]) => v != null && v !== "");
}

function TableRowsBrowser({ table }: { table: string }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(50);
  const { data, isLoading, isError, error, isFetching } =
    useMarketplaceAdminDataInventoryRows(table, page, pageSize, true);

  const from = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          실제 행 데이터
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className={`flex items-center gap-1 ${ADMIN_TEXT_META}`}>
            페이지 크기
            <select
              className="rounded border border-zinc-300 bg-white px-1.5 py-1 text-zinc-800"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          {data ? (
            <span className={ADMIN_TEXT_META}>
              전체 {data.total.toLocaleString("ko-KR")}행 중{" "}
              {data.total === 0
                ? "0"
                : `${from.toLocaleString("ko-KR")}–${to.toLocaleString("ko-KR")}`}
              {isFetching ? " · 불러오는 중…" : ""}
            </span>
          ) : null}
        </div>
      </div>

      {data?.redactedColumns?.length ? (
        <p className={`text-xs ${ADMIN_TEXT_META}`}>
          민감 컬럼 마스킹: {data.redactedColumns.join(", ")}
        </p>
      ) : null}

      {isLoading ? (
        <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>행 불러오는 중…</p>
      ) : null}
      {isError ? (
        <p className="text-sm text-red-600">
          {(error as Error).message}
        </p>
      ) : null}

      {data && data.rows.length === 0 ? (
        <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>행이 없습니다.</p>
      ) : null}

      {data && data.rows.length > 0 ? (
        <div className="max-h-[28rem] overflow-auto rounded border border-zinc-200">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-zinc-100">
              <tr>
                <th className="whitespace-nowrap border-b border-zinc-200 px-2 py-1.5 font-medium text-zinc-500">
                  #
                </th>
                {data.columns.map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap border-b border-zinc-200 px-2 py-1.5 font-medium text-zinc-600"
                  >
                    {col}
                    {data.redactedColumns.includes(col) ? " *" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-zinc-100 odd:bg-white even:bg-zinc-50/80"
                >
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono text-zinc-400">
                    {(data.page - 1) * data.pageSize + idx + 1}
                  </td>
                  {data.columns.map((col) => (
                    <td
                      key={col}
                      className="max-w-[20rem] truncate px-2 py-1.5 font-mono text-zinc-800"
                      title={formatCell(row[col])}
                    >
                      {formatCell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {data && data.totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium disabled:opacity-40"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage(1)}
          >
            처음
          </button>
          <button
            type="button"
            className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium disabled:opacity-40"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            이전
          </button>
          <span className={`text-xs ${ADMIN_TEXT_META}`}>
            {page} / {data.totalPages}
          </span>
          <button
            type="button"
            className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium disabled:opacity-40"
            disabled={page >= data.totalPages || isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </button>
          <button
            type="button"
            className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium disabled:opacity-40"
            disabled={page >= data.totalPages || isFetching}
            onClick={() => setPage(data.totalPages)}
          >
            마지막
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DataStoreCard({
  store,
  defaultOpen = false,
}: {
  store: DataStoreInventoryRow;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [browseRows, setBrowseRows] = useState(false);
  const extras = highlightEntries(store.highlights);

  return (
    <div className={`${ADMIN_PANEL} overflow-hidden`} id={`store-${store.id}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left sm:px-5 sm:py-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-zinc-900 sm:text-base">
              {store.label}
            </p>
            <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600">
              {store.table}
            </span>
            {storeStaleReason(store) === "empty" ? (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                비어 있음
              </span>
            ) : null}
            {storeStaleReason(store) === "stale90" ? (
              <span className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-800">
                90일+ 무활동
              </span>
            ) : null}
          </div>
          <p className={`mt-1.5 text-xs sm:text-sm ${ADMIN_TEXT_SECONDARY}`}>
            {store.rowCount.toLocaleString("ko-KR")}행
            {store.lastActivityAt ? (
              <>
                {" "}
                · 최근 활동{" "}
                <span className="font-medium text-zinc-800">
                  {formatWhen(store.lastActivityAt)}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <span className={`shrink-0 text-sm ${ADMIN_TEXT_MUTED}`}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-zinc-200 px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              무엇을 저장하나요
            </p>
            <p className={`mt-1.5 text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
              {store.description}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              어떻게 쌓이나요
            </p>
            <p className={`mt-1.5 text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
              {store.howAccumulated}
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-zinc-50 px-3 py-2">
              <dt className={`text-xs ${ADMIN_TEXT_META}`}>가장 오래된 기록</dt>
              <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                {formatWhen(store.oldestAt)}
              </dd>
            </div>
            <div className="rounded-md bg-zinc-50 px-3 py-2">
              <dt className={`text-xs ${ADMIN_TEXT_META}`}>가장 최근 기록</dt>
              <dd className="mt-0.5 text-sm font-medium text-zinc-900">
                {formatWhen(store.newestAt)}
              </dd>
            </div>
            <div className="rounded-md bg-zinc-50 px-3 py-2">
              <dt className={`text-xs ${ADMIN_TEXT_META}`}>행 수</dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold text-zinc-900">
                {store.rowCount.toLocaleString("ko-KR")}
              </dd>
            </div>
          </dl>

          {extras.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                하이라이트
              </p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {extras.map(([key, value]) => (
                  <li
                    key={key}
                    className="rounded-md bg-zinc-50 px-3 py-2 text-xs sm:text-sm"
                  >
                    <span className={ADMIN_TEXT_META}>
                      {formatHighlightKey(key)}
                    </span>
                    <span className="ml-2 font-medium text-zinc-900">
                      {typeof value === "number"
                        ? value.toLocaleString("ko-KR")
                        : String(value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {store.adminPagePath ? (
            <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>
              관련 어드민:{" "}
              <Link href={store.adminPagePath} className={ADMIN_LINK}>
                {store.adminPagePath.replace("/marketplace/admin/", "")}
              </Link>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
            <button
              type="button"
              className="rounded-md border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
              onClick={() => setBrowseRows((v) => !v)}
            >
              {browseRows
                ? "행 데이터 닫기"
                : `행 전부 보기 (${store.rowCount.toLocaleString("ko-KR")}행)`}
            </button>
            <span className={`text-xs ${ADMIN_TEXT_META}`}>
              페이지 단위로 전체 행을 조회합니다 (최대 페이지당 200행).
            </span>
          </div>

          {browseRows ? <TableRowsBrowser table={store.table} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function StaleStoresPanel({ stores }: { stores: DataStoreInventoryRow[] }) {
  const rows = stores
    .map((store) => ({ store, reason: storeStaleReason(store) }))
    .filter((r): r is { store: DataStoreInventoryRow; reason: string } =>
      Boolean(r.reason),
    )
    .sort((a, b) => a.store.table.localeCompare(b.store.table));

  if (rows.length === 0) {
    return (
      <div className={`${ADMIN_ARTICLE} mb-6`}>
        <AdminSectionTitle
          title="90일 무적재 후보"
          subtitle="비어 있거나 최근 활동이 90일을 넘긴 테이블이 지금은 없습니다."
        />
      </div>
    );
  }

  return (
    <div className={`${ADMIN_ARTICLE} mb-6`}>
      <AdminSectionTitle
        title="90일 무적재 후보"
        subtitle="비어 있거나 lastActivity가 90일 이전인 테이블입니다. 코드가 살아있는 기능 테이블은 비어 있어도 삭제하지 않습니다."
      />
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className={`border-b border-zinc-200 text-xs ${ADMIN_TEXT_META}`}>
              <th className="py-2 pr-3 font-medium">테이블</th>
              <th className="py-2 pr-3 font-medium">상태</th>
              <th className="py-2 pr-3 font-medium">권장</th>
              <th className="py-2 font-medium text-right">행 수</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ store, reason }) => {
              const keep = KEEP_IF_EMPTY.has(store.table);
              return (
                <tr key={store.table} className="border-b border-zinc-100">
                  <td className="py-2 pr-3">
                    <a href={`#store-${store.id}`} className={ADMIN_LINK}>
                      {store.table}
                    </a>
                  </td>
                  <td className="py-2 pr-3 text-zinc-700">
                    {reason === "empty" ? "비어 있음" : "90일+ 무활동"}
                  </td>
                  <td className={`py-2 pr-3 ${ADMIN_TEXT_SECONDARY}`}>
                    {keep
                      ? "기능 테이블 — 유지 (P2P·시세·PSA 메일 등)"
                      : store.domain === "other"
                        ? "카탈로그 없음 — 레거시 후보"
                        : "확인 후 결정 (코어일 수 있음)"}
                  </td>
                  <td className="py-2 text-right font-mono">
                    {store.rowCount.toLocaleString("ko-KR")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GlanceTile({
  label,
  value,
  hint,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 rounded-lg border px-3 py-3 text-left transition sm:px-4 ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50"
      }`}
    >
      <p
        className={`text-xs font-medium ${active ? "text-zinc-300" : ADMIN_TEXT_MUTED}`}
      >
        {label}
      </p>
      <p
        className={`mt-0.5 break-words text-lg font-semibold sm:text-xl ${
          active ? "text-white" : "text-zinc-900"
        }`}
      >
        {typeof value === "number" ? value.toLocaleString("ko-KR") : value}
      </p>
      <p
        className={`mt-1 text-[11px] leading-snug ${
          active ? "text-zinc-400" : ADMIN_TEXT_SECONDARY
        }`}
      >
        {hint}
      </p>
      <p
        className={`mt-2 text-[11px] font-medium ${
          active ? "text-zinc-200" : "text-zinc-500"
        }`}
      >
        {active ? "상세 닫기 ▲" : "눌러서 구성 보기 ▼"}
      </p>
    </button>
  );
}

export function MarketplaceAdminDataInventoryPage() {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useMarketplaceAdminDataInventory();
  const resetMutation = useMarketplaceAdminResetForNewContract();
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<
    DataInventoryDomainId | "all"
  >("all");
  const [glanceKey, setGlanceKey] = useState<GlanceKey | null>(null);

  const storesByDomain = useMemo(() => {
    if (!data) return new Map<DataInventoryDomainId, DataStoreInventoryRow[]>();
    const map = new Map<DataInventoryDomainId, DataStoreInventoryRow[]>();
    for (const store of data.stores) {
      const list = map.get(store.domain) ?? [];
      list.push(store);
      map.set(store.domain, list);
    }
    return map;
  }, [data]);

  const catalogRows = useMemo(
    () =>
      (storesByDomain.get("catalog") ?? []).reduce((s, r) => s + r.rowCount, 0),
    [storesByDomain],
  );
  const marketsRows = useMemo(
    () =>
      (storesByDomain.get("markets") ?? []).reduce((s, r) => s + r.rowCount, 0),
    [storesByDomain],
  );

  const glanceStores = useMemo(() => {
    if (!data || !glanceKey) return [];
    const all = [...data.stores].sort((a, b) => b.rowCount - a.rowCount);
    if (glanceKey === "stores" || glanceKey === "total") return all;
    if (glanceKey === "catalog") {
      return all.filter((s) => s.domain === "catalog");
    }
    if (glanceKey === "markets") {
      return all.filter((s) => s.domain === "markets");
    }
    return all.filter((s) => s.domain === "other");
  }, [data, glanceKey]);

  const otherRows = useMemo(
    () =>
      (storesByDomain.get("other") ?? []).reduce((s, r) => s + r.rowCount, 0),
    [storesByDomain],
  );

  const glanceMeta: Record<
    GlanceKey,
    { title: string; meaning: string }
  > = {
    stores: {
      title: "추적 중인 저장소",
      meaning:
        "public 스키마의 모든 테이블 + 카탈로그 설명입니다. 아래 목록이 곧 이 숫자의 정체입니다.",
    },
    total: {
      title: "전체 행 수",
      meaning:
        "모든 테이블 rowCount 단순 합입니다. 같은 카드가 여러 테이블에 있으면 중복 합산됩니다.",
    },
    catalog: {
      title: "카탈로그 도메인 행 수",
      meaning:
        "컬렉션·RWA 토큰·벌크 민트·파트너 등 카탈로그·민트 도메인만 합산합니다.",
    },
    markets: {
      title: "시세 도메인 행 수",
      meaning:
        "시세 스냅샷·Top 100·델타 임포트 등 Cardhedger 시세 도메인만 합산합니다.",
    },
    other: {
      title: "기타 테이블 행 수",
      meaning:
        "카탈로그에 설명이 아직 없는 public 테이블들입니다. 스키마에 있으면 모두 여기에 표시됩니다.",
    },
  };

  const visibleDomains =
    domainFilter === "all"
      ? (data?.domains ?? [])
      : (data?.domains.filter((d) => d.id === domainFilter) ?? []);

  const toggleGlance = (key: GlanceKey) => {
    setGlanceKey((prev) => (prev === key ? null : key));
  };

  return (
    <>
      <MarketplaceAdminPageHeader
        title="데이터 인벤토리"
        subtitle="상단 스키마 맵에서 테이블·키·연결을 보고, 아래에서 행 수와 실제 데이터를 조회합니다."
        actions={
          <button
            type="button"
            className={ADMIN_BTN_DANGER}
            disabled={resetMutation.isPending}
            onClick={() => {
              const ok = window.confirm(
                "새 RWA 컨트랙트용으로 마켓·볼트 DB를 초기화할까요?\n\n" +
                  "삭제: rwa_tokens, orders, collections, vault, portfolio, watchlist, bulk mint, P2P, redeems…\n\n" +
                  "유지: users, wallets, KYC, admins, partners\n\n" +
                  ".env의 CHAIN_*_RWA_ADDRESS / NEXT_PUBLIC_CHAIN_*_RWA를 새 프록시로 바꾼 뒤 backend/frontend를 재시작한 다음 실행하세요.\n\n" +
                  "개발/스테이징 전용. 온체인 NFT는 번되지 않습니다.",
              );
              if (!ok) return;
              const password = window.prompt("초기화 비밀번호를 입력하세요:");
              if (password == null) return;
              if (password.trim() === "") {
                setResetError("비밀번호가 비어 있어 취소되었습니다.");
                return;
              }
              setResetError(null);
              setResetMessage(null);
              void resetMutation
                .mutateAsync(password.trim())
                .then((r) => {
                  const wiped = Object.entries(r.rowCountsBefore)
                    .filter(([, n]) => n > 0)
                    .map(([t, n]) => `${t}=${n}`)
                    .slice(0, 12)
                    .join(", ");
                  setResetMessage(
                    `초기화 완료 — ${r.truncatedTables.length}개 테이블 truncate` +
                      (wiped ? ` (이전 행: ${wiped})` : ""),
                  );
                })
                .catch((e) => {
                  setResetError(e instanceof Error ? e.message : String(e));
                });
            }}
          >
            {resetMutation.isPending
              ? "초기화 중…"
              : "새 컨트랙트용 DB 초기화 (dev)"}
          </button>
        }
      />

      <div className="mb-5">
        <AdminDataInventorySchemaMap />
      </div>

      <div className={`${ADMIN_ARTICLE} mb-5 flex flex-wrap items-center gap-3`}>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
        >
          {isFetching ? "새로고침 중…" : "새로고침"}
        </button>
        {data?.generatedAt ? (
          <span className={`text-xs ${ADMIN_TEXT_META}`}>
            생성 시각 {new Date(data.generatedAt).toLocaleString("ko-KR")}
          </span>
        ) : null}
      </div>

      {resetMessage ? (
        <div className={`${ADMIN_ARTICLE} mb-5 text-sm text-emerald-700`}>
          {resetMessage}
        </div>
      ) : null}
      {resetError ? (
        <div className={`${ADMIN_ARTICLE} mb-5 text-sm text-red-600`}>
          {resetError}
        </div>
      ) : null}

      {isError ? (
        <div className={`${ADMIN_ARTICLE} mb-5 text-sm text-red-600`}>
          {(error as Error).message}
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className={`${ADMIN_ARTICLE} text-sm text-zinc-700`}>
          데이터 인벤토리 불러오는 중…
        </div>
      ) : null}

      {data ? (
        <>
          <div className={`${ADMIN_ARTICLE} mb-6`}>
            <AdminSectionTitle
              title="한눈에 보기"
              subtitle="숫자만 보지 말고 타일을 눌러 어떤 테이블이 합쳐진 값인지 확인하세요. (비즈니스 엔티티 기준 중복 제거 없음)"
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
              <GlanceTile
                label="추적 중인 저장소"
                value={data.totals.storeCount}
                hint="전체 public 테이블"
                active={glanceKey === "stores"}
                onClick={() => toggleGlance("stores")}
              />
              <GlanceTile
                label="전체 행 수"
                value={data.totals.rowCount.toLocaleString("ko-KR")}
                hint={
                  data.totals.rowCountsEstimated
                    ? "pg_class 추정 합 (빈 테이블은 COUNT 확인)"
                    : "모든 테이블 row 합"
                }
                active={glanceKey === "total"}
                onClick={() => toggleGlance("total")}
              />
              <GlanceTile
                label="카탈로그 행 수"
                value={catalogRows.toLocaleString("ko-KR")}
                hint="카탈로그·민트"
                active={glanceKey === "catalog"}
                onClick={() => toggleGlance("catalog")}
              />
              <GlanceTile
                label="시세 행 수"
                value={marketsRows.toLocaleString("ko-KR")}
                hint="시세·Cardhedger"
                active={glanceKey === "markets"}
                onClick={() => toggleGlance("markets")}
              />
              <GlanceTile
                label="기타 테이블 행 수"
                value={otherRows.toLocaleString("ko-KR")}
                hint="미분류 public 테이블"
                active={glanceKey === "other"}
                onClick={() => toggleGlance("other")}
              />
            </div>

            {glanceKey ? (
              <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <h3 className="text-sm font-semibold text-zinc-900">
                  {glanceMeta[glanceKey].title}
                </h3>
                <p className={`mt-1.5 text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
                  {glanceMeta[glanceKey].meaning}
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className={`border-b border-zinc-200 text-xs ${ADMIN_TEXT_META}`}>
                        <th className="py-2 pr-3 font-medium">이름</th>
                        <th className="py-2 pr-3 font-medium">테이블</th>
                        <th className="py-2 pr-3 font-medium">도메인</th>
                        <th className="py-2 pr-3 font-medium text-right">행 수</th>
                        <th className="py-2 font-medium">최근 활동</th>
                      </tr>
                    </thead>
                    <tbody>
                      {glanceStores.map((store) => {
                        const domainLabel =
                          data.domains.find((d) => d.id === store.domain)
                            ?.label ?? store.domain;
                        return (
                          <tr
                            key={store.id}
                            className="border-b border-zinc-100 last:border-0"
                          >
                            <td className="py-2 pr-3">
                              <a
                                href={`#store-${store.id}`}
                                className={ADMIN_LINK}
                                onClick={() => {
                                  if (
                                    glanceKey === "catalog" ||
                                    glanceKey === "markets" ||
                                    glanceKey === "other"
                                  ) {
                                    setDomainFilter(store.domain);
                                  } else {
                                    setDomainFilter("all");
                                  }
                                }}
                              >
                                {store.label}
                              </a>
                            </td>
                            <td className="py-2 pr-3 font-mono text-xs text-zinc-600">
                              {store.table}
                            </td>
                            <td className="py-2 pr-3 text-zinc-700">
                              {domainLabel}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono font-medium text-zinc-900">
                              {store.rowCount.toLocaleString("ko-KR")}
                            </td>
                            <td className="py-2 text-xs text-zinc-600">
                              {formatWhen(store.lastActivityAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className={`mt-3 text-xs ${ADMIN_TEXT_META}`}>
                  이름 링크를 누르면 아래 목록의 해당 카드로 이동합니다. 카드를
                  펼친 뒤 「행 전부 보기」로 실제 DB 행을 조회할 수 있습니다.
                </p>
              </div>
            ) : null}
          </div>

          <StaleStoresPanel stores={data.stores} />

          <div className={`${ADMIN_ARTICLE} mb-6`}>
            <AdminSectionTitle
              title="도메인 필터"
              subtitle="어드민 콘솔의 업무 영역과 맞춰 둔 묶음입니다"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDomainFilter("all")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  domainFilter === "all"
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                전체
              </button>
              {data.domains.map((domain) => (
                <button
                  key={domain.id}
                  type="button"
                  onClick={() => setDomainFilter(domain.id)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    domainFilter === domain.id
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  {domain.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            {visibleDomains.map((domain) => {
              const stores = storesByDomain.get(domain.id) ?? [];
              const domainRows = stores.reduce((s, r) => s + r.rowCount, 0);
              return (
                <section key={domain.id}>
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-zinc-900">
                      {domain.label}
                    </h2>
                    <p
                      className={`mt-1 max-w-3xl text-sm ${ADMIN_TEXT_SECONDARY}`}
                    >
                      {domain.summary}
                    </p>
                    <p className={`mt-1 text-xs ${ADMIN_TEXT_META}`}>
                      저장소 {stores.length}개 ·{" "}
                      {domainRows.toLocaleString("ko-KR")}행
                    </p>
                  </div>
                  <div className="space-y-3">
                    {stores.map((store) => (
                      <DataStoreCard key={store.id} store={store} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <div
            className={`${ADMIN_ARTICLE} mt-8 ${ADMIN_TEXT_SECONDARY} text-sm`}
          >
            <AdminSectionTitle title="이 페이지 읽는 법" />
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                각 카드를 펼친 뒤{" "}
                <strong>행 전부 보기</strong>를 누르면 해당 테이블의 실제 DB
                행을 페이지 단위(최대 200행)로 전부 확인할 수 있습니다. 비밀번호·시크릿
                컬럼은 마스킹됩니다.
              </li>
              <li>
                <strong>추가만 하는(append-only)</strong> 테이블(Top 100
                스냅샷, 델타 임포트 로그, KYC 이벤트)은 날짜·이벤트마다 행이
                늘어나고 히스토리가 남습니다.
              </li>
              <li>
                <strong>덮어쓰는(upsert)</strong> 테이블(컬렉션 시세 스냅샷)은
                키당 1행을 유지하며 가격·JSON을 갱신합니다.
              </li>
              <li>
                PSA cert 메타는{" "}
                <code className="font-mono text-xs">
                  marketplace_collections.components
                </code>{" "}
                안에 들어 있습니다 — 민트 시 조회하며 별도 스냅샷 테이블이
                아닙니다.
              </li>
              <li>
                Cardhedger 동기화 이력은{" "}
                <Link
                  href="/marketplace/admin/price-webhooks"
                  className={ADMIN_LINK}
                >
                  Price sync
                </Link>
                , 포트폴리오 크론은{" "}
                <Link
                  href="/marketplace/admin/portfolio"
                  className={ADMIN_LINK}
                >
                  Portfolio ops
                </Link>
                를 보세요.
              </li>
            </ul>
          </div>
        </>
      ) : null}
    </>
  );
}
