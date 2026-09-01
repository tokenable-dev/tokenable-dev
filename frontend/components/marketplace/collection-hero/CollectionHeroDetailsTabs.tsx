"use client";

import { useState, type ReactNode } from "react";

type SidebarTab = "details" | "psa";

const TAB_BASE =
  "cd-ob-tab shrink-0 px-4 py-2.5 text-[15px] transition-colors duration-200";
const TAB_ACTIVE = "cd-ob-tab--active";
const TAB_INACTIVE = "";

function SidebarTabButton({
  id,
  label,
  active,
  onSelect,
}: {
  id: SidebarTab;
  label: string;
  active: boolean;
  onSelect: (id: SidebarTab) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`collection-sidebar-tab-${id}`}
      aria-selected={active}
      aria-controls={`collection-sidebar-panel-${id}`}
      onClick={() => onSelect(id)}
      className={`${TAB_BASE} ${active ? TAB_ACTIVE : TAB_INACTIVE}`}
    >
      {label}
    </button>
  );
}

/** Card.html Details / PSA Population tabs — same chrome on mobile and desktop. */
export function CollectionHeroDetailsTabs({
  detailsPanel,
  psaPanel,
}: {
  detailsPanel: ReactNode;
  psaPanel?: ReactNode;
}) {
  const [tab, setTab] = useState<SidebarTab>("details");
  const showPsa = psaPanel != null;

  return (
    <div className="cd-sidebar-tabs w-full min-w-0 max-w-full">
      <div
        className="cd-ob-tabs relative flex w-full shrink-0 items-end border-b border-white/[0.08] bg-transparent"
        role="tablist"
        aria-label="Collection information"
      >
        <div className="flex shrink-0 justify-start gap-0">
          <SidebarTabButton
            id="details"
            label="Details"
            active={tab === "details"}
            onSelect={setTab}
          />
          {showPsa ? (
            <SidebarTabButton
              id="psa"
              label="Pop."
              active={tab === "psa"}
              onSelect={setTab}
            />
          ) : null}
        </div>
      </div>

      <div className="cd-sidebar-tabs__body">
        {tab === "details" ? (
          <div
            id="collection-sidebar-panel-details"
            role="tabpanel"
            aria-labelledby="collection-sidebar-tab-details"
            className="cd-sidebar-tabs__panel"
          >
            {detailsPanel}
          </div>
        ) : showPsa ? (
          <div
            id="collection-sidebar-panel-psa"
            role="tabpanel"
            aria-labelledby="collection-sidebar-tab-psa"
            className="cd-sidebar-tabs__panel"
          >
            {psaPanel}
          </div>
        ) : null}
      </div>
    </div>
  );
}
