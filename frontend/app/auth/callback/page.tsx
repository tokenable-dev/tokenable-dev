"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";
import { formatAuthError } from "@/lib/auth/formatAuthError";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refresh = useAuthStore((s) => s.refresh);
  const consumeReturnTo = useAuthUiStore((s) => s.consumeReturnTo);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setErr(formatAuthError(decodeURIComponent(oauthError)));
      return;
    }

    void (async () => {
      try {
        await refresh();
        const returnTo = consumeReturnTo();
        router.replace(returnTo ?? "/");
      } catch (e) {
        setErr(formatAuthError(e instanceof Error ? e.message : "Failed"));
      }
    })();
  }, [refresh, router, searchParams, consumeReturnTo]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-black px-4 text-white">
      <div className="text-center">
        {err ? (
          <>
            <p className="mb-4 text-sm text-red-400">{err}</p>
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="text-sm font-medium text-mint hover:text-mint/80"
            >
              Home
            </button>
          </>
        ) : (
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-black">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
