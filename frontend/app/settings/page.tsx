"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { useAuthStore } from "@/store/authStore";

function SettingsPageGate() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    if (!loading && initialized && !user) {
      router.replace("/login");
    }
  }, [user, loading, initialized, router]);

  if (!user) {
    return (
      <div className="secondary-page secondary-page--centered">
        <div className="secondary-spinner" aria-label="Loading settings" />
      </div>
    );
  }

  return <SettingsPage user={user} />;
}

export default function SettingsRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="secondary-page secondary-page--centered">
          <div className="secondary-spinner" aria-label="Loading settings" />
        </div>
      }
    >
      <SettingsPageGate />
    </Suspense>
  );
}
