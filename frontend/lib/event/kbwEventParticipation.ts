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

/**
 * Stage 1 is stored per scope. Wallet-only login uses `user:{id}` until a real
 * email is saved (`email:{address}`) — keep progress across that transition.
 */
export function readKbwStage1Done(
  scope: string,
  userId?: string,
): boolean {
  storageRemove(STAGE1_DONE_LEGACY);
  if (storageGet(stage1StorageKey(scope)) === "1") return true;
  const id = userId?.trim();
  if (id && scope.startsWith("email:")) {
    return storageGet(stage1StorageKey(`user:${id}`)) === "1";
  }
  return false;
}

export function writeKbwStage1Done(scope: string, userId?: string): void {
  storageRemove(STAGE1_DONE_LEGACY);
  storageSet(stage1StorageKey(scope), "1");
  const id = userId?.trim();
  if (id) storageSet(stage1StorageKey(`user:${id}`), "1");
}

/** After `@privy.wallet` → real email, copy Stage 1 onto the email scope key. */
export function migrateKbwStage1AfterContactEmail(
  userId: string | undefined,
  email: string | undefined,
): void {
  if (!userId) return;
  const emailScope = kbwEventParticipationScope(userId, email);
  if (!emailScope.startsWith("email:")) return;
  const userScope = `user:${userId}`;
  if (storageGet(stage1StorageKey(userScope)) === "1") {
    storageSet(stage1StorageKey(emailScope), "1");
  }
}

/** After guest Stage 1, copy progress onto the logged-in account. */
export function claimGuestKbwStage1ForAccount(
  userId: string | undefined,
  email: string | undefined,
): void {
  const scope = kbwEventParticipationScope(userId, email);
  if (scope === "guest") return;
  if (!readKbwStage1Done("guest")) return;
  writeKbwStage1Done(scope, userId);
  storageRemove(stage1StorageKey("guest"));
}
