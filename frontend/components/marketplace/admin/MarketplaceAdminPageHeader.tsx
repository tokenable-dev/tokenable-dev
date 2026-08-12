"use client";

import type { ReactNode } from "react";
import { ADMIN_PAGE_SUBTITLE, ADMIN_PAGE_TITLE } from "./adminUi";

export function MarketplaceAdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 border-b border-zinc-200 pb-4 sm:mb-6 sm:pb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className={ADMIN_PAGE_TITLE}>{title}</h1>
          {subtitle ? <p className={ADMIN_PAGE_SUBTITLE}>{subtitle}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}
