"use client";

import { ADMIN_PAGE_SUBTITLE, ADMIN_PAGE_TITLE } from "./adminUi";

export function MarketplaceAdminPageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-5 border-b border-zinc-200 pb-4 sm:mb-6 sm:pb-5">
      <h1 className={ADMIN_PAGE_TITLE}>{title}</h1>
      {subtitle ? <p className={ADMIN_PAGE_SUBTITLE}>{subtitle}</p> : null}
    </header>
  );
}
