"use client";

import type { ReactNode } from "react";
import { rwaDetailRightFont } from "../theme";

export function RwaDetailPageShell({
  showMain,
  children,
}: {
  showMain: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`rwa-detail-page ${rwaDetailRightFont.className} ${
        showMain
          ? "max-lg:h-[calc(100svh-4rem)] max-lg:max-h-[calc(100svh-4rem)] max-lg:overflow-hidden"
          : "min-h-screen"
      }`}
    >
      <main
        className={`rwa-detail-page__shell ${rwaDetailRightFont.className} ${
          showMain ? "rwa-detail-page__shell--main" : ""
        } ${
          showMain
            ? "max-lg:flex max-lg:h-full max-lg:min-h-0 max-lg:flex-col max-lg:items-center max-lg:overflow-hidden max-lg:py-2 max-lg:pb-0"
            : ""
        } lg:min-h-screen`}
      >
        {children}
      </main>
    </div>
  );
}
