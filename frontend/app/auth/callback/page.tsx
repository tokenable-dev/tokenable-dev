"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";

export default function AuthCallbackPage() {
  const router = useRouter();
  const refresh = useAuthStore((s) => s.refresh);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        await refresh();
        router.replace("/");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Sign-in failed");
      }
    })();
  }, [refresh, router]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="text-center">
        {err ? (
          <>
            <p className="text-red-400 text-sm mb-4">{err}</p>
            <button
              type="button"
              onClick={() => router.replace("/login")}
              className="text-amber-500 hover:underline"
            >
              Back to login
            </button>
          </>
        ) : (
          <p className="text-gray-400 text-sm">Signing you in…</p>
        )}
      </div>
    </div>
  );
}
