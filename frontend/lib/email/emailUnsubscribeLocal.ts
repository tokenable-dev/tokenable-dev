/** Browser-only UI until server unsubscribe API exists. */

const STORAGE_KEY = "tk_email_unsubscribe_ui";
export const EMAIL_UNSUBSCRIBE_UI_EVENT = "tk-email-unsubscribe-ui";

type Stored = { v: 1; email: string; at: number };

export function setEmailUnsubscribeUiActive(email: string): void {
  if (typeof window === "undefined") return;
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return;
  const payload: Stored = { v: 1, email: normalized, at: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event(EMAIL_UNSUBSCRIBE_UI_EVENT));
}

export function readEmailUnsubscribeUiActive(
  sessionEmail?: string | null,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.v !== 1 || !parsed.email) return false;
    const session = sessionEmail?.trim().toLowerCase() ?? "";
    if (session && parsed.email !== session) return false;
    return true;
  } catch {
    return false;
  }
}

export function clearEmailUnsubscribeUi(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
