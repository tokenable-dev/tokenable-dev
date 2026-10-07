/** Post-login navigation — shared by auth UI store and Privy OAuth redirects. */
export const AUTH_RETURN_TO_KEY = "tk_auth_return_to";

export function resolveAuthReturnTo(
  pathname: string | null | undefined,
  searchParams: { toString(): string } | null | undefined,
): string {
  const pathOnly = pathname?.split("?")[0] ?? "/";
  const search = searchParams?.toString() ?? "";
  return pathOnly && pathOnly !== "/"
    ? `${pathOnly}${search ? `?${search}` : ""}`
    : "/";
}

export function readAuthReturnTo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const path =
      sessionStorage.getItem(AUTH_RETURN_TO_KEY) ??
      localStorage.getItem(AUTH_RETURN_TO_KEY);
    return path && path.startsWith("/") ? path : null;
  } catch {
    return null;
  }
}

export function writeAuthReturnTo(path: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (path && path.startsWith("/")) {
      sessionStorage.setItem(AUTH_RETURN_TO_KEY, path);
      localStorage.setItem(AUTH_RETURN_TO_KEY, path);
    } else {
      sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
      localStorage.removeItem(AUTH_RETURN_TO_KEY);
    }
  } catch {
    /* quota / private mode */
  }
}
