/**
 * KBW `/event` Stage 1 (Instagram) progress only.
 * Offer-modal visibility is NOT stored here — it follows portfolio mystery-card
 * presence (`burned === false` → show; `burned === true` → hide).
 */

import { isWalletOnlyPlaceholderEmail } from "@/lib/auth/walletOnlyEmail";

const STAGE1_DONE_PREFIX = "tk_kbw_stage1_done:";
const STAGE1_DONE_LEGACY = "tk_kbw_stage1_done";

function storageGet(key: string): string | null {
  try {
    const local = localStorage.getItem(key);
    if (local != null) return local;
    const session = sessionStorage.getItem(key);
    if (session != null) {
      try {
        localStorage.setItem(key, session);
      } catch {
        /* ignore */
      }
      return session;
    }
    return null;
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function kbwEventParticipationScope(
  userId: string | undefined,
  email: string | undefined,
): string {
  const em = email?.trim().toLowerCase() ?? "";
  if (em && !isWalletOnlyPlaceholderEmail(em)) return `email:${em}`;
  const id = userId?.trim();
  if (id) return `user:${id}`;
  return "guest";
}

function stage1StorageKey(scope: string): string {
  return `${STAGE1_DONE_PREFIX}${scope}`;
}

export function readKbwStage1Done(scope: string): boolean {
  storageRemove(STAGE1_DONE_LEGACY);
  return storageGet(stage1StorageKey(scope)) === "1";
}

export function writeKbwStage1Done(scope: string): void {
  storageRemove(STAGE1_DONE_LEGACY);
  storageSet(stage1StorageKey(scope), "1");
}

/** After guest Stage 1, copy progress onto the logged-in account. */
export function claimGuestKbwStage1ForAccount(
  userId: string | undefined,
  email: string | undefined,
): void {
  const scope = kbwEventParticipationScope(userId, email);
  if (scope === "guest") return;
  if (!readKbwStage1Done("guest")) return;
  writeKbwStage1Done(scope);
  storageRemove(stage1StorageKey("guest"));
}
