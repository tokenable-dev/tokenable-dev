"use client";

import type { AdminAnalyticsPeriod } from "@/lib/core";
import {
  ADMIN_BTN_SECONDARY,
  ADMIN_SEGMENT,
  ADMIN_SEGMENT_BTN,
  ADMIN_SEGMENT_BTN_ACTIVE,
  ADMIN_TEXT_META,
  ADMIN_TOOLBAR,
} from "./adminUi";

const PERIODS: { value: AdminAnalyticsPeriod; label: string }[] = [
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
];

type Props = {
  days: AdminAnalyticsPeriod;
  onDaysChange: (days: AdminAnalyticsPeriod) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  updatedAt?: string | null;
};

export function AdminPeriodSelector({
  days,
  onDaysChange,
  onRefresh,
  isRefreshing,
  updatedAt,
}: Props) {
  return (
    <div className={`${ADMIN_TOOLBAR} mb-5 sm:mb-6`}>
      <span className={`text-xs font-medium sm:text-sm ${ADMIN_TEXT_META}`}>Period</span>
      <div className={ADMIN_SEGMENT}>
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onDaysChange(p.value)}
            className={
              days === p.value ? ADMIN_SEGMENT_BTN_ACTIVE : ADMIN_SEGMENT_BTN
            }
          >
            {p.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className={`${ADMIN_BTN_SECONDARY} w-full sm:ml-auto sm:w-auto`}
      >
        {isRefreshing ? "Refreshing…" : "Refresh"}
      </button>
      {updatedAt ? (
        <span className={`w-full text-xs sm:w-auto sm:text-sm ${ADMIN_TEXT_META}`}>
          Updated {new Date(updatedAt).toLocaleString()}
        </span>
      ) : null}
    </div>
  );
}
