"use client";

import { ADMIN_ARTICLE, ADMIN_BTN_PRIMARY, ADMIN_TEXT_SECONDARY } from "./adminUi";
import { AdminSectionTitle } from "./AdminAnalyticsWidgets";
import { GA4_CONSOLE_URL } from "./ga4Console";

type Props = {
  variant?: "compact" | "full";
};

export function AdminGa4ExternalLink({ variant = "full" }: Props) {
  const isCompact = variant === "compact";

  return (
    <div className={`${ADMIN_ARTICLE} mb-5 sm:mb-6`}>
      <AdminSectionTitle
        title="Traffic analytics"
        subtitle={
          isCompact
            ? "Visitors, sessions, and page views — open in Google Analytics"
            : "Detailed traffic reports live in Google Analytics for now. In-app analytics will be added later."
        }
      />
      <p className={`mb-4 text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
        {isCompact
          ? "Use the GA4 dashboard for realtime users, top pages, acquisition, and device breakdowns."
          : "Sign in with a Google account that has access to the Tokenable GA4 property."}
      </p>
      <a
        href={GA4_CONSOLE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${ADMIN_BTN_PRIMARY} inline-flex items-center gap-2`}
      >
        Open Google Analytics
        <span aria-hidden className="text-base leading-none">
          ↗
        </span>
      </a>
    </div>
  );
}
