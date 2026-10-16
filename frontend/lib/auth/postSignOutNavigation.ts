/** Routes that should not stay visible after sign-out (no auto sign-in modal). */
export function pathnameRequiresLeaveAfterSignOut(pathname: string): boolean {
  const path = pathname.split("?")[0] || "/";
  if (path === "/settings" || path.startsWith("/settings/")) return true;
  if (path === "/kyc") return true;
  if (path.startsWith("/partner/")) return true;
  if (path.startsWith("/vault/submit") || path.startsWith("/vault/submissions")) {
    return true;
  }
  if (path === "/vault/list") return true;
  return false;
}
