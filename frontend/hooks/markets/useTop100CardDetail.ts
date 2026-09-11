"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAllPricesByCard,
  getCardDetails,
  getPriceByGrade,
  getPricesByCard,
} from "@/lib/core/api/cardhedger";
import { rq, marketplaceRqPolicy } from "@/lib/core/queryKeys";
import { parseTop100Price } from "@/lib/markets/top100CardDisplay";
import { computePriceMetrics, normalizePriceHistory } from "@/lib/markets/top100PriceMetrics";

export type Top100GradePriceOption = {
  grade: string;
  price: number | null;
  displayOrder: number;
};

export type UseTop100CardDetailOptions = {
  /** Category for 90-day sales fallback (`90day-prices-by-grade`). */
  category?: string;
  /** PSA 10 (or list) snapshot sales — avoids extra API when grade matches. */
  snapshotSales90?: number | null;
  /** Grade tied to `snapshotSales90` (defaults to initial hook `grade`). */
  snapshotGrade?: string | null;
};

function normalizeSalesCount(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

export function useTop100CardDetail(
  cardId: string,
  grade: string,
  chartDays: number,
  opts?: UseTop100CardDetailOptions,
) {
  const detailsQuery = useQuery({
    queryKey: rq.cardhedgerCardDetails(cardId),
    queryFn: () => getCardDetails(cardId),
    staleTime: marketplaceRqPolicy.cardhedgerStaleMs,
    gcTime: marketplaceRqPolicy.cardhedgerGcMs,
    enabled: Boolean(cardId),
  });

  const historyQuery = useQuery({
    queryKey: rq.cardhedgerPricesByCard(cardId, grade, chartDays),
    queryFn: () => getPricesByCard({ card_id: cardId, grade, days: chartDays }),
    staleTime: marketplaceRqPolicy.cardhedgerStaleMs,
    gcTime: marketplaceRqPolicy.cardhedgerGcMs,
    enabled: Boolean(cardId && grade),
  });

  const allGradesQuery = useQuery({
    queryKey: rq.cardhedgerAllPricesByCard(cardId),
    queryFn: () => getAllPricesByCard(cardId),
    staleTime: marketplaceRqPolicy.cardhedgerStaleMs,
    gcTime: marketplaceRqPolicy.cardhedgerGcMs,
    enabled: Boolean(cardId),
  });

  const card = detailsQuery.data?.cards?.[0] ?? null;

  const sales90FromDetails = normalizeSalesCount(card?.["90_day_sales"]);
  const snapshotGrade = opts?.snapshotGrade?.trim() || grade;
  const sales90FromSnapshot =
    grade === snapshotGrade
      ? normalizeSalesCount(opts?.snapshotSales90)
      : null;

  const sales90Primary = sales90FromDetails ?? sales90FromSnapshot;
  const needsSales90Fallback = sales90Primary == null && Boolean(cardId && grade);

  const sales90FallbackQuery = useQuery({
    queryKey: rq.cardhedger90DaySalesFallback(
      cardId,
      grade,
      opts?.category ?? card?.category ?? "",
      card?.description ?? "",
    ),
    queryFn: async () => {
      const res = await getPriceByGrade({
        grade,
        category: opts?.category ?? card?.category ?? undefined,
        search: card?.description?.trim() || undefined,
        page: 1,
        page_size: 100,
      });
      const match = res.cards.find((c) => c.card_id === cardId);
      return normalizeSalesCount(match?.["90_day_sales"]);
    },
    staleTime: marketplaceRqPolicy.cardhedgerStaleMs,
    gcTime: marketplaceRqPolicy.cardhedgerGcMs,
    enabled: needsSales90Fallback,
  });

  const gradeOptions = useMemo(() => {
    const fromAll = allGradesQuery.data?.prices ?? [];
    const sorted = [...fromAll].sort((a, b) => {
      const ao = Number(a.display_order ?? 999);
      const bo = Number(b.display_order ?? 999);
      return ao - bo;
    });
    const grades = sorted.map((p) => p.grade).filter(Boolean);
    if (grades.length > 0) return [...new Set(grades)];
    if (grade) return [grade];
    return ["PSA 10"];
  }, [allGradesQuery.data, grade]);

  const series = useMemo(
    () => normalizePriceHistory(historyQuery.data?.prices ?? []),
    [historyQuery.data],
  );

  const metrics = useMemo(() => computePriceMetrics(series.points), [series.points]);

  const gradePrices = useMemo((): Top100GradePriceOption[] => {
    const fromAll = allGradesQuery.data?.prices ?? [];
    const sorted = [...fromAll].sort((a, b) => {
      const ao = Number(a.display_order ?? 999);
      const bo = Number(b.display_order ?? 999);
      return ao - bo;
    });
    return sorted
      .filter((p) => p.grade)
      .map((p) => ({
        grade: p.grade,
        price: parseTop100Price(p.price),
        displayOrder: Number(p.display_order ?? 999),
      }));
  }, [allGradesQuery.data]);

  const sales30 = card?.["30 Day Sales"] ?? null;
  const sales90 =
    sales90Primary ?? sales90FallbackQuery.data ?? null;
  const sales90Loading =
    needsSales90Fallback &&
    (sales90FallbackQuery.isLoading || sales90FallbackQuery.isFetching);

  return {
    card,
    gradeOptions,
    gradePrices,
    series,
    metrics,
    sales30,
    sales7: card?.["7 Day Sales"] ?? null,
    sales90,
    sales90Loading,
    salesAllGradesLoading: detailsQuery.isLoading,
    isLoading:
      detailsQuery.isLoading || historyQuery.isLoading || allGradesQuery.isLoading,
    isError: detailsQuery.isError || historyQuery.isError,
    error: detailsQuery.error ?? historyQuery.error ?? null,
    isFetching: historyQuery.isFetching,
  };
}
