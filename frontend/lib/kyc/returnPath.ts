/** Where to send the user after KYC completes (survives OAuth / reloads). */
export const KYC_RETURN_KEY = "tk_kyc_return_to";

const FALLBACK_AFTER_KYC = "/vault";

export function rememberKycReturnTo(path: string | null | undefined): void {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/kyc")) {
    return;
  }
  try {
    sessionStorage.setItem(KYC_RETURN_KEY, path);
  } catch {
    /* ignore quota / private mode */
  }
}

export function peekKycReturnTo(): string | null {
  try {
    const path = sessionStorage.getItem(KYC_RETURN_KEY);
    if (path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/kyc")) {
      return path;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function clearKycReturnTo(): void {
  try {
    sessionStorage.removeItem(KYC_RETURN_KEY);
  } catch {
    /* ignore */
  }
}

/** Prefer explicit launch path, then stored, then a safe product default. */
export function resolveKycReturnPath(
  ...candidates: Array<string | null | undefined>
): string {
  for (const raw of candidates) {
    if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/kyc")) {
      return raw;
    }
  }
  return peekKycReturnTo() ?? FALLBACK_AFTER_KYC;
}
