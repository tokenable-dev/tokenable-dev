"use client";

import { useEffect } from "react";

export function AiInsightComingSoonModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-insight-coming-soon-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-[min(100%,20rem)] rounded-2xl border border-zinc-600/70 bg-[#161616] px-5 py-6 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06]">
        <h2
          id="ai-insight-coming-soon-title"
          className="text-lg font-semibold tracking-tight text-white"
        >
          AI Insights
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">
          This feature isn&apos;t available yet. We&apos;re preparing it for a future release.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
