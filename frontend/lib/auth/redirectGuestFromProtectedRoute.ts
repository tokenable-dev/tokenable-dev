import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Send guests away from account-only URLs (no sign-in modal).
 * Returns true when a redirect was scheduled.
 */
export function redirectGuestFromProtectedRoute(
  router: AppRouterInstance,
  pathname: string,
): boolean {
  const path = pathname.split("?")[0] || "/";

  if (path === "/settings" || path.startsWith("/settings/")) {
    router.replace("/");
    return true;
  }
  if (path === "/kyc") {
    router.replace("/");
    return true;
  }
  if (path.startsWith("/vault/submit") || path.startsWith("/vault/submissions")) {
    router.replace("/markets");
    return true;
  }
  if (path === "/vault/list") {
    router.replace("/markets");
    return true;
  }
  if (path.startsWith("/partner/")) {
    router.replace("/");
    return true;
  }

  return false;
}
