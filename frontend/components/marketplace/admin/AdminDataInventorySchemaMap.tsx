"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMarketplaceAdminDataInventorySchema } from "@/hooks/marketplace-admin/useMarketplaceAdminDataInventory";
import type {
  DataInventoryDomainId,
  DataInventorySchemaEdge,
  DataInventorySchemaTable,
} from "@/lib/core/api/marketplace-admin-data-inventory";
import { ADMIN_PANEL, ADMIN_TEXT_META, ADMIN_TEXT_SECONDARY } from "./adminUi";

const DOMAIN_ORDER: { id: DataInventoryDomainId; label: string }[] = [
  { id: "catalog", label: "카탈로그·민트" },
  { id: "markets", label: "시세·Cardhedger" },
  { id: "portfolio", label: "포트폴리오·워치리스트" },
  { id: "trading", label: "거래" },
  { id: "people", label: "계정·감사" },
  { id: "vault", label: "볼트 라이프사이클" },
  { id: "other", label: "기타 테이블" },
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

type Line = {
  id: string;
  d: string;
  kind: DataInventorySchemaEdge["kind"];
  active: boolean;
};

export function AdminDataInventorySchemaMap() {
  const { data, isLoading, isError, error } =
    useMarketplaceAdminDataInventorySchema();
  const [domain, setDomain] = useState<DataInventoryDomainId | "all">("all");
  const [focus, setFocus] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const [lines, setLines] = useState<Line[]>([]);

  const tables = useMemo(() => {
    if (!data) return [];
    if (domain === "all") return data.tables;
    return data.tables.filter((t) => t.domain === domain);
  }, [data, domain]);

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

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || edges.length === 0) {
      setLines([]);
      return;
    }
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
      const mid = (x1 + x2) / 2;
      const active =
        focus == null || focus === edge.fromTable || focus === edge.toTable;
      next.push({
        id: edge.id,
        kind: edge.kind,
        active,
        d: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`,
      });
    }
    setLines(next);
  }, [edges, focus, tables]);

  const jump = (table: string) => {
    setFocus(table);
    document.getElementById(`store-${table}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <section className={`${ADMIN_PANEL} overflow-hidden`}>
      <div className="border-b border-zinc-200 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              DB 스키마 맵
            </h2>
            <p className={`mt-1 max-w-3xl text-sm ${ADMIN_TEXT_SECONDARY}`}>
              현재 Postgres public 테이블입니다.{" "}
              <span className="font-medium text-zinc-800">PK</span> /{" "}
              <span className="font-medium text-zinc-800">UK</span> /{" "}
              <span className="font-medium text-zinc-800">FK</span>는 DB 제약이고,
              점선은 앱이 조인하는 논리 키입니다 (마켓플레이스 코어는 FK가 거의 없음).
            </p>
          </div>
          <p className={`text-xs ${ADMIN_TEXT_META}`}>
            {data
              ? `${data.tables.length}개 테이블 · ${data.edges.length}개 연결`
              : "불러오는 중"}
          </p>
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
            <span className="rounded bg-zinc-900 px-1 py-0.5 font-mono text-[10px] text-white">
              PK
            </span>{" "}
            기본키
          </li>
          <li>
            <span className="rounded bg-zinc-600 px-1 py-0.5 font-mono text-[10px] text-white">
              UK
            </span>{" "}
            유니크
          </li>
          <li>
            <span className="rounded bg-sky-700 px-1 py-0.5 font-mono text-[10px] text-white">
              FK
            </span>{" "}
            외래키
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
        <div ref={wrapRef} className="relative overflow-x-auto px-3 py-4 sm:px-4">
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden
          >
            {lines.map((line) => (
              <path
                key={line.id}
                d={line.d}
                fill="none"
                stroke={line.kind === "fk" ? "#18181b" : "#71717a"}
                strokeWidth={line.active ? 1.6 : 0.7}
                strokeOpacity={line.active ? 0.85 : 0.18}
                strokeDasharray={line.kind === "logical" ? "5 4" : undefined}
              />
            ))}
          </svg>

          <div className="relative flex min-w-max items-start gap-5">
            {groups.map((group) => (
              <div key={group.id} className="w-[220px] shrink-0">
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {group.label}
                </p>
                <div className="flex flex-col gap-3">
                  {group.tables.map((table) => (
                    <SchemaTableCard
                      key={table.table}
                      table={table}
                      focused={focus === table.table}
                      dimmed={
                        focus != null &&
                        focus !== table.table &&
                        !edges.some(
                          (e) =>
                            (e.fromTable === focus && e.toTable === table.table) ||
                            (e.toTable === focus && e.fromTable === table.table),
                        )
                      }
                      onFocus={() =>
                        setFocus((prev) =>
                          prev === table.table ? null : table.table,
                        )
                      }
                      onJump={() => jump(table.table)}
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

function SchemaTableCard({
  table,
  focused,
  dimmed,
  onFocus,
  onJump,
  cardRef,
}: {
  table: DataInventorySchemaTable;
  focused: boolean;
  dimmed: boolean;
  onFocus: () => void;
  onJump: () => void;
  cardRef: (el: HTMLButtonElement | null) => void;
}) {
  const keys = table.columns.filter((c) => c.primaryKey || c.unique || c.foreignKey);
  const shown = keys.length > 0 ? keys : table.columns.slice(0, 4);

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onFocus}
      onDoubleClick={onJump}
      className={`w-full rounded-lg border px-2.5 py-2 text-left shadow-sm transition ${
        DOMAIN_TONE[table.domain]
      } ${focused ? "ring-2 ring-zinc-900" : ""} ${dimmed ? "opacity-35" : ""}`}
    >
      <p className="truncate text-xs font-semibold text-zinc-900">
        {table.label}
      </p>
      <p className="truncate font-mono text-[10px] text-zinc-500">{table.table}</p>
      <p className="mt-0.5 text-[10px] text-zinc-500">
        {table.rowCount.toLocaleString("ko-KR")}행
      </p>
      <ul className="mt-1.5 space-y-0.5">
        {shown.map((col) => (
          <li
            key={col.name}
            className="flex items-center gap-1 font-mono text-[10px] text-zinc-700"
          >
            {col.primaryKey ? (
              <span className="rounded bg-zinc-900 px-1 text-[9px] text-white">
                PK
              </span>
            ) : null}
            {col.unique && !col.primaryKey ? (
              <span className="rounded bg-zinc-600 px-1 text-[9px] text-white">
                UK
              </span>
            ) : null}
            {col.foreignKey ? (
              <span className="rounded bg-sky-700 px-1 text-[9px] text-white">
                FK
              </span>
            ) : null}
            <span className="truncate">{col.name}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}
