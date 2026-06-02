"use client";

import type { ReactNode } from "react";

export function RwaDetailPageShell({
  showMain,
  children,
}: {
  showMain: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`bg-[#07090c] text-white max-xl:bg-black ${
        showMain
          ? "max-lg:h-[calc(100svh-4rem)] max-lg:max-h-[calc(100svh-4rem)] max-lg:overflow-hidden"
          : "min-h-screen"
      }`}
    >
      <main
        className={`mx-auto w-full max-w-6xl px-3 py-6 max-[380px]:px-2.5 sm:px-5 sm:py-8 lg:min-h-screen lg:px-6 lg:pb-8 ${
          showMain
            ? "max-lg:flex max-lg:h-full max-lg:min-h-0 max-lg:flex-col max-lg:overflow-hidden max-lg:py-2 max-lg:pb-0"
            : "max-lg:pb-6"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
