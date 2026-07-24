/** Set to `true` when public Vault flows are ready for launch. */
export const VAULT_PUBLIC_ENABLED = false;

export const VAULT_COMING_SOON_MESSAGE =
  "Vault is coming soon. This feature is not available yet.";

export function isVaultPublicPath(path: string): boolean {
  const base = path.split(/[?#]/)[0] ?? path;
  return base === "/vault" || base.startsWith("/vault/");
}

export function notifyVaultComingSoon(): void {
  if (typeof window !== "undefined") {
    window.alert(VAULT_COMING_SOON_MESSAGE);
  }
}
