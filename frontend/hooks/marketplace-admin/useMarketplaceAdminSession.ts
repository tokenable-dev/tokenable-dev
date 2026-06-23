"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getMarketplaceAdminSession,
  loginMarketplaceAdmin,
  logoutMarketplaceAdmin,
} from "@/lib/core/api/marketplace-admin-auth";

export function useMarketplaceAdminSession() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const session = await getMarketplaceAdminSession();
      setAuthenticated(session.authenticated);
      setUsername(session.username);
    } catch {
      setAuthenticated(false);
      setUsername(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (input: { username: string; password: string }) => {
      const result = await loginMarketplaceAdmin(input);
      setAuthenticated(true);
      setUsername(result.username);
      return result;
    },
    [],
  );

  const logout = useCallback(async () => {
    await logoutMarketplaceAdmin();
    setAuthenticated(false);
    setUsername(null);
  }, []);

  return {
    authenticated,
    username,
    loading,
    refresh,
    login,
    logout,
  };
}
