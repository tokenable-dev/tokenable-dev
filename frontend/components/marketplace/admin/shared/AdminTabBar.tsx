"use client";

import Link from "next/link";
import {
  ADMIN_SEGMENT_BTN,
  ADMIN_SEGMENT_BTN_ACTIVE,
} from "../adminUi";

export type AdminTab = {
  id: string;
  label: string;
  href: string;
};

export function AdminTabBar({
  tabs,
  activeId,
}: {
  tabs: AdminTab[];
  activeId: string;
}) {
  return (
    <div
      className="mb-5 flex gap-1 overflow-x-auto pb-1 sm:mb-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Section tabs"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const className = active ? ADMIN_SEGMENT_BTN_ACTIVE : ADMIN_SEGMENT_BTN;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={className}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
