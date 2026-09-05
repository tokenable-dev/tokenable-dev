"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  useMarketplaceAdminDataInventoryRows,
  useMarketplaceAdminDataInventorySchema,
} from "@/hooks/marketplace-admin/useMarketplaceAdminDataInventory";
import type {
  DataInventoryDomainId,
  DataInventorySchemaColumn,
  DataInventorySchemaEdge,
  DataInventorySchemaTable,
} from "@/lib/core/api/marketplace-admin-data-inventory";
import { ADMIN_PANEL, ADMIN_TEXT_META, ADMIN_TEXT_SECONDARY } from "./adminUi";

const DOMAIN_ORDER: { id: DataInventoryDomainId; label: string }[] = [
  { id: "catalog", label: "카탈로그·민트" },
  { id: "markets", label: "시세·Cardhedger" },
  { id: "portfolio", label: "포트폴리오" },
  { id: "trading", label: "거래" },
  { id: "people", label: "계정" },
  { id: "vault", label: "볼트" },
  { id: "other", label: "기타" },
];

const DOMAIN_TONE: Record<DataInventoryDomainId, string> = {
  catalog: "border-sky-300 bg-sky-50",
  markets: "border-violet-300 bg-violet-50",
  portfolio: "border-amber-300 bg-amber-50",
  trading: "border-emerald-300 bg-emerald-50",
  people: "border-zinc-300 bg-zinc-50",
  vault: "border-orange-300 bg-orange-50",
  other: "border-rose-200 bg-rose-50",
};

/** Opt-in Cardhedger pipelines (flags default off). Not the live list/detail price path. */
const OPTIONAL_CARDHEDGER = new Set([
  "cardhedger_price_subscriptions",
  "cardhedger_daily_price_export_runs",
  "cardhedger_price_delta_checkpoints",
  "cardhedger_price_delta_import_runs",
]);

type Line = {
  id: string;
  d: string;
  lx: number;
  ly: number;
  label: string;
  kind: DataInventorySchemaEdge["kind"];
  active: boolean;
};

export function AdminDataInventorySchemaMap() {
  const { data, isLoading, isError, error } =
    useMarketplaceAdminDataInventorySchema();
  const [domain, setDomain] = useState<DataInventoryDomainId | "all">("all");
  const [showOptionalCardhedger, setShowOptionalCardhedger] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const [lines, setLines] = useState<Line[]>([]);

  const tables = useMemo(() => {
    if (!data) return [];
    return data.tables.filter((t) => {
      if (!showOptionalCardhedger && OPTIONAL_CARDHEDGER.has(t.table)) {
        return false;
      }
      if (domain !== "all" && t.domain !== domain) return false;
      return true;
    });
  }, [data, domain, showOptionalCardhedger]);

  const visible = useMemo(() => new Set(tables.map((t) => t.table)), [tables]);

  const edges = useMemo(() => {
    if (!data) return [];
    return data.edges.filter(
      (e) => visible.has(e.fromTable) && visible.has(e.toTable),
    );
  }, [data, visible]);

  const groups = useMemo(() => {
    const map = new Map<DataInventoryDomainId, DataInventorySchemaTable[]>();
    for (const table of tables) {
      const list = map.get(table.domain) ?? [];
      list.push(table);
      map.set(table.domain, list);
    }
    return DOMAIN_ORDER.filter((d) => (map.get(d.id)?.length ?? 0) > 0).map(
      (d) => ({ ...d, tables: map.get(d.id) ?? [] }),
    );
  }, [tables]);

  const focusedTable = tables.find((t) => t.table === focus) ?? null;

  const neighborEdges = useMemo(() => {
    if (!focus) return [];
    return edges.filter((e) => e.fromTable === focus || e.toTable === focus);
  }, [edges, focus]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) {
      setLines([]);
      return;
    }

    const draw = () => {
      const box = wrap.getBoundingClientRect();
      const next: Line[] = [];
      for (const edge of edges) {
        const fromEl = cardRefs.current.get(edge.fromTable);
        const toEl = cardRefs.current.get(edge.toTable);
        if (!fromEl || !toEl) continue;
        const a = fromEl.getBoundingClientRect();
        const b = toEl.getBoundingClientRect();
        const x1 = a.right - box.left;
        const y1 = a.top + a.height / 2 - box.top;
        const x2 = b.left - box.left;
        const y2 = b.top + b.height / 2 - box.top;
        const sameCol = Math.abs(a.left - b.left) < 24;
        const d = sameCol
          ? `M ${x1} ${y1} C ${x1 + 36} ${y1}, ${x2 + 36} ${y2}, ${x2} ${y2}`
          : `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;
        const active =
          focus == null ||
          focus === edge.fromTable ||
          focus === edge.toTable;
        next.push({
          id: edge.id,
          kind: edge.kind,
          active,
          d,
          lx: (x1 + x2) / 2,
          ly: (y1 + y2) / 2 - 4,
          label: `${edge.fromColumn} → ${edge.toTable}.${edge.toColumn}`,
        });
      }
      setLines(next);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [edges, focus, tables, zoom]);

  return (
    <section className={`${ADMIN_PANEL} overflow-hidden`}>
      <div className="border-b border-zinc-200 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">DB 스키마 맵</h2>
            <p className={`mt-1 max-w-4xl text-sm ${ADMIN_TEXT_SECONDARY}`}>
              테이블을 클릭하면 오른쪽에서 키·연결·샘플 행을 봅니다. 실선은
              Postgres FK, 점선은 앱이 조인하는 논리 키입니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs ${ADMIN_TEXT_META}`}>
              {data
                ? `${tables.length}개 테이블 · ${edges.length}개 연결`
                : "불러오는 중"}
            </span>
            <div className="inline-flex overflow-hidden rounded-md border border-zinc-300">
              {[0.85, 1, 1.2].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoom(z)}
                  className={`px-2 py-1 text-xs font-medium ${
                    zoom === z
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {Math.round(z * 100)}%
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <FilterChip
            active={domain === "all"}
            onClick={() => setDomain("all")}
            label="전체"
          />
          {DOMAIN_ORDER.map((d) => (
            <FilterChip
              key={d.id}
              active={domain === d.id}
              onClick={() => setDomain(d.id)}
              label={d.label}
            />
          ))}
          <label
            className={`ml-2 inline-flex items-center gap-1.5 text-xs ${ADMIN_TEXT_META}`}
          >
            <input
              type="checkbox"
              checked={showOptionalCardhedger}
              onChange={(e) => setShowOptionalCardhedger(e.target.checked)}
            />
            Cardhedger 부가 인프라 (웹훅·델타·CSV)
          </label>
        </div>

        <ul className={`mt-3 flex flex-wrap gap-4 text-xs ${ADMIN_TEXT_META}`}>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-6 bg-zinc-800" />
            DB FK
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-6 border-t-2 border-dashed border-zinc-500" />
            논리 조인
          </li>
          <li>
            <KeyBadge kind="pk" /> 기본키
          </li>
          <li>
            <KeyBadge kind="uk" /> 유니크
          </li>
          <li>
            <KeyBadge kind="fk" /> 외래키
          </li>
        </ul>
      </div>

      {isLoading ? (
        <p className={`px-4 py-8 text-sm ${ADMIN_TEXT_SECONDARY}`}>
          스키마를 그리는 중…
        </p>
      ) : null}
      {isError ? (
        <p className="px-4 py-6 text-sm text-red-600">
          {(error as Error).message}
        </p>
      ) : null}

      {data ? (
        <div className="relative">
          <div className="max-h-[78vh] overflow-auto bg-zinc-100/70">
            <div
              ref={wrapRef}
              className="relative min-h-[72vh] origin-top-left p-6"
              style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%` }}
            >
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                aria-hidden
              >
                {lines.map((line) => (
                  <g key={line.id}>
                    <path
                      d={line.d}
                      fill="none"
                      stroke={line.kind === "fk" ? "#18181b" : "#52525b"}
                      strokeWidth={line.active ? 2 : 1}
                      strokeOpacity={
                        focus == null ? 0.35 : line.active ? 0.95 : 0.08
                      }
                      strokeDasharray={
                        line.kind === "logical" ? "6 5" : undefined
                      }
                    />
                    {line.active && focus != null ? (
                      <text
                        x={line.lx}
                        y={line.ly}
                        textAnchor="middle"
                        className="fill-zinc-700"
                        style={{ fontSize: 11, fontFamily: "ui-monospace, monospace" }}
                      >
                        {line.label}
                      </text>
                    ) : null}
                  </g>
                ))}
              </svg>

              <div className="relative flex min-w-max items-start gap-8">
                {groups.map((group) => (
                  <div key={group.id} className="w-[280px] shrink-0">
                    <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      {group.label}
                    </p>
                    <div className="flex flex-col gap-4">
                      {group.tables.map((table) => (
                        <SchemaTableCard
                          key={table.table}
                          table={table}
                          focused={focus === table.table}
                          dimmed={
                            focus != null &&
                            focus !== table.table &&
                            !neighborEdges.some(
                              (e) =>
                                e.fromTable === table.table ||
                                e.toTable === table.table,
                            )
                          }
                          optional={OPTIONAL_CARDHEDGER.has(table.table)}
                          onFocus={() => setFocus(table.table)}
                          cardRef={(el) => {
                            if (el) cardRefs.current.set(table.table, el);
                            else cardRefs.current.delete(table.table);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {focusedTable ? (
            <SchemaDetailDrawer
              table={focusedTable}
              edges={neighborEdges}
              onClose={() => setFocus(null)}
              onSelectTable={setFocus}
            />
          ) : null}
        </div>
      ) : null}
    </section>
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
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-zinc-900 text-white"
          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

function KeyBadge({ kind }: { kind: "pk" | "uk" | "fk" }) {
  const cls =
    kind === "pk"
      ? "bg-zinc-900"
      : kind === "uk"
        ? "bg-zinc-600"
        : "bg-sky-700";
  return (
    <span
      className={`rounded px-1 py-0.5 font-mono text-[10px] font-semibold text-white ${cls}`}
    >
      {kind.toUpperCase()}
    </span>
  );
}

function SchemaTableCard({
  table,
  focused,
  dimmed,
  optional,
  onFocus,
  cardRef,
}: {
  table: DataInventorySchemaTable;
  focused: boolean;
  dimmed: boolean;
  optional: boolean;
  onFocus: () => void;
  cardRef: (el: HTMLButtonElement | null) => void;
}) {
  const keys = table.columns.filter(
    (c) => c.primaryKey || c.unique || c.foreignKey,
  );
  const shown = keys.length > 0 ? keys.slice(0, 8) : table.columns.slice(0, 6);

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onFocus}
      className={`w-full rounded-xl border px-3 py-3 text-left shadow-sm transition ${
        DOMAIN_TONE[table.domain]
      } ${focused ? "ring-2 ring-zinc-900 shadow-md" : "hover:shadow-md"} ${
        dimmed ? "opacity-25" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900">{table.label}</p>
        {optional ? (
          <span className="shrink-0 rounded bg-violet-200 px-1.5 py-0.5 text-[10px] font-medium text-violet-900">
            부가
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">
        {table.table}
      </p>
      <p className="mt-1 text-[11px] text-zinc-500">
        {table.rowCount.toLocaleString("ko-KR")}행
      </p>
      <ul className="mt-2 space-y-1">
        {shown.map((col) => (
          <ColumnRow key={col.name} col={col} as="li" />
        ))}
      </ul>
    </button>
  );
}

function ColumnRow({
  col,
  as: Tag = "div",
}: {
  col: DataInventorySchemaColumn;
  as?: "div" | "li";
}) {
  return (
    <Tag className="flex items-center gap-1 font-mono text-[11px] text-zinc-700">
      {col.primaryKey ? <KeyBadge kind="pk" /> : null}
      {col.unique && !col.primaryKey ? <KeyBadge kind="uk" /> : null}
      {col.foreignKey ? <KeyBadge kind="fk" /> : null}
      <span className="truncate">{col.name}</span>
      <span className="ml-auto truncate text-[10px] text-zinc-400">
        {col.dataType}
      </span>
    </Tag>
  );
}

function SchemaDetailDrawer({
  table,
  edges,
  onClose,
  onSelectTable,
}: {
  table: DataInventorySchemaTable;
  edges: DataInventorySchemaEdge[];
  onClose: () => void;
  onSelectTable: (table: string) => void;
}) {
  return (
    <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-zinc-900">{table.label}</p>
          <p className="truncate font-mono text-xs text-zinc-500">{table.table}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          닫기
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>
          {table.rowCount.toLocaleString("ko-KR")}행
          {OPTIONAL_CARDHEDGER.has(table.table)
            ? " · Cardhedger 부가 파이프라인 (플래그 기본 off)"
            : null}
        </p>
        {table.description ? (
          <p className={`text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
            {table.description}
          </p>
        ) : null}
        {table.howAccumulated ? (
          <p className={`text-xs leading-relaxed ${ADMIN_TEXT_META}`}>
            {table.howAccumulated}
          </p>
        ) : null}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            컬럼 · 키
          </p>
          <ul className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {table.columns.map((col) => (
              <li key={col.name} className="px-2.5 py-1.5">
                <ColumnRow col={col} as="div" />
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            연결
          </p>
          {edges.length === 0 ? (
            <p className={`mt-2 text-sm ${ADMIN_TEXT_SECONDARY}`}>
              표시된 맵에서 연결된 테이블이 없습니다.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {edges.map((edge) => {
                const outgoing = edge.fromTable === table.table;
                const other = outgoing ? edge.toTable : edge.fromTable;
                return (
                  <li key={edge.id}>
                    <button
                      type="button"
                      onClick={() => onSelectTable(other)}
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left hover:border-zinc-400 hover:bg-white"
                    >
                      <p className="text-[11px] font-medium text-zinc-500">
                        {edge.kind === "fk" ? "DB FK" : "논리 조인"}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-zinc-800">
                        {outgoing
                          ? `${edge.fromColumn} → ${edge.toTable}.${edge.toColumn}`
                          : `${edge.toTable}.${edge.toColumn} ← ${edge.fromTable}.${edge.fromColumn}`}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">
                        {other} 보기
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <SchemaRowsPeek table={table.table} />
      </div>
    </aside>
  );
}

function SchemaRowsPeek({ table }: { table: string }) {
  const { data, isLoading, isError, error } =
    useMarketplaceAdminDataInventoryRows(table, 1, 5, true, true);

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        샘플 행
      </p>
      {isLoading ? (
        <p className={`mt-2 text-sm ${ADMIN_TEXT_SECONDARY}`}>불러오는 중…</p>
      ) : null}
      {isError ? (
        <p className="mt-2 text-sm text-red-600">{(error as Error).message}</p>
      ) : null}
      {data && data.rows.length === 0 ? (
        <p className={`mt-2 text-sm ${ADMIN_TEXT_SECONDARY}`}>행이 없습니다.</p>
      ) : null}
      {data && data.rows.length > 0 ? (
        <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-zinc-200">
          <table className="min-w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-zinc-100">
              <tr>
                {data.columns.slice(0, 6).map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap px-2 py-1 font-medium text-zinc-600"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} className="border-t border-zinc-100">
                  {data.columns.slice(0, 6).map((col) => (
                    <td
                      key={col}
                      className="max-w-[9rem] truncate px-2 py-1 font-mono text-zinc-800"
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
    </div>
  );
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
