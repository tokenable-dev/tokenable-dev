"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

const MESSAGES: Record<string, string> = {
  ok: "Email verified",
  invalid: "Invalid link",
  expired: "Link expired",
  missing: "Invalid request",
};

function EmailVerifyToastInner() {
  const searchParams = useSearchParams();
  const refresh = useAuthStore((s) => s.refresh);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const v = searchParams.get("email_verify");
    if (!v) return;
    void refresh();
    setOk(v === "ok");
    setMsg(MESSAGES[v] ?? "Could not verify");
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.searchParams.delete("email_verify");
      window.history.replaceState({}, "", u.pathname + (u.search || ""));
    }
    const t = setTimeout(() => setMsg(null), 5000);
    return () => clearTimeout(t);
  }, [searchParams, refresh]);

  if (!msg) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-[150] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border px-4 py-2.5 text-center text-sm font-medium shadow-lg ${
        ok
          ? "border-mint/30 bg-[#0a1210]/95 text-mint shadow-mint/10"
          : "border-red-500/25 bg-gray-950/95 text-red-300"
      }`}
      role="status"
    >
      {msg}
    </div>
  );
}

export function EmailVerifyToast() {
  return (
    <Suspense fallback={null}>
      <EmailVerifyToastInner />
    </Suspense>
  );
}
