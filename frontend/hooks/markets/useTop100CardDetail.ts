"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAllPricesByCard,
  getCardDetails,
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

export function useTop100CardDetail(cardId: string, grade: string, chartDays: number) {
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

  return {
    card,
    gradeOptions,
    gradePrices,
    series,
    metrics,
    sales30,
    sales7: card?.["7 Day Sales"] ?? null,
    isLoading:
      detailsQuery.isLoading || historyQuery.isLoading || allGradesQuery.isLoading,
    isError: detailsQuery.isError || historyQuery.isError,
    error: detailsQuery.error ?? historyQuery.error ?? null,
    isFetching: historyQuery.isFetching,
  };
}
