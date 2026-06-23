"use client";

import type { AuthBanner } from "@/store/authUiStore";

const TONE_CLASS: Record<AuthBanner["tone"], string> = {
  success: "border-mint/30 bg-mint/10 text-mint",
  error: "border-red-500/30 bg-red-500/10 text-red-300",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-200",
};

function BannerIcon({ tone }: { tone: AuthBanner["tone"] }) {
  if (tone === "success") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (tone === "error") {
    return (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}

export function AuthNoticeBanner({ banner }: { banner: AuthBanner }) {
  return (
    <div
      className={`mb-4 flex gap-3 rounded-xl border px-3.5 py-3 text-left ${TONE_CLASS[banner.tone]}`}
      role="status"
    >
      <BannerIcon tone={banner.tone} />
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug">{banner.title}</p>
        {banner.body ? (
          <p className="mt-0.5 text-xs leading-relaxed opacity-90">{banner.body}</p>
        ) : null}
      </div>
    </div>
  );
}
