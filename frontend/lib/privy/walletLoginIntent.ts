/** Shared browser helpers used by Privy login UI and event landing. */

const AUTH_RETURN_TO_KEY = "tk_auth_return_to";

/** Drop mobile drawer scroll lock so Privy modal / OAuth redirect are not blocked. */
function releaseMobileDrawerScrollLock(): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("gnb-drawer-open");
  document.body.classList.remove("gnb-drawer-open");
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  const shell = document.querySelector<HTMLElement>(".tk-shell-scroll");
  if (shell) shell.style.overflow = "";
  const mobileRoot = document.querySelector<HTMLElement>(".mobile-page-root");
  if (mobileRoot) mobileRoot.style.overflow = "";
}

/**
 * Open Privy's login modal. MetaMask opens only if the user picks it there.
 * Persists `returnTo` for OAuth full-page redirects (sessionStorage survives Google/Apple return).
 */
export function startPrivyLogin(
  login: () => void,
  opts?: { returnTo?: string },
): void {
  const returnTo = opts?.returnTo?.trim();
  if (returnTo?.startsWith("/")) {
    try {
      sessionStorage.setItem(AUTH_RETURN_TO_KEY, returnTo);
    } catch {
      /* private mode */
    }
  }
  if (isMobileBrowserUa()) {
    releaseMobileDrawerScrollLock();
  }
  login();
}

export function isMobileBrowserUa(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}
