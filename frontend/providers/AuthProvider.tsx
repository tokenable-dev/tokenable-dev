"use client";

import { useEffect } from "react";
import { useActivePartner } from "@/hooks/partner/useActivePartner";
import { useAuthStore } from "@/store/authStore";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useAuthStore.getState().refresh();
  }, []);

  // Home / GNB: partner status must be in cache before Portfolio / Sell links resolve.
  useActivePartner();

  return <>{children}</>;
}
