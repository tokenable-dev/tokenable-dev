/** Routes that should not stay visible after sign-out (no auto sign-in modal). */
export function pathnameRequiresLeaveAfterSignOut(pathname: string): boolean {
  const path = pathname.split("?")[0] || "/";
  if (path === "/settings" || path.startsWith("/settings/")) return true;
  if (path === "/kyc") return true;
  if (path.startsWith("/partner/")) return true;
  // Sell hub + flow — wallet-gated; leave to landing instead of re-prompting Privy.
  if (path === "/sell" || path.startsWith("/sell/")) return true;
  if (path === "/vault" || path.startsWith("/vault/")) return true;
  return false;
}
