"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthUser, EmailNotifPrefs } from "@/lib/auth";
import { updateAuthProfile } from "@/lib/auth";
import { cn } from "@/lib/ds/cn";
import {
  clearEmailUnsubscribeUi,
  EMAIL_UNSUBSCRIBE_UI_EVENT,
  readEmailUnsubscribeUiActive,
} from "@/lib/email/emailUnsubscribeLocal";
import { useAuthStore } from "@/store/authStore";

type AccountRowId =
  | "sales"
  | "purchases"
  | "shipping"
  | "withdrawals"
  | "identity";

const ACCOUNT_ROWS: {
  id: AccountRowId;
  title: string;
  description: string;
}[] = [
  {
    id: "sales",
    title: "Sales & payouts",
    description: "When your card sells and when your payout lands.",
  },
  {
    id: "purchases",
    title: "Purchases",
    description: "Receipts for cards you buy.",
  },
  {
    id: "shipping",
    title: "Shipping & redemption",
    description: "Order, shipping, tracking, and refunds.",
  },
  {
    id: "withdrawals",
    title: "Withdrawals",
    description: "When funds leave your balance.",
  },
  {
    id: "identity",
    title: "Identity & account",
    description: "Verification results and account status.",
  },
];

const DEFAULT_ACCOUNT_TOGGLES: Record<AccountRowId, boolean> = {
  sales: true,
  purchases: true,
  shipping: true,
  withdrawals: true,
  identity: true,
};

const ALL_OFF_ACCOUNT_TOGGLES: Record<AccountRowId, boolean> = {
  sales: false,
  purchases: false,
  shipping: false,
  withdrawals: false,
  identity: false,
};

const ALL_OFF_OPTIONAL_PREFS: Pick<EmailNotifPrefs, "listing" | "price" | "market"> = {
  listing: false,
  price: false,
  market: false,
};

const OPTIONAL_ROWS: {
  id: "listing" | "price" | "market" | "news";
  title: string;
  description: string;
  prefKey?: keyof Pick<EmailNotifPrefs, "listing" | "price" | "market">;
  marketing?: boolean;
}[] = [
  {
    id: "listing",
    title: "Listing alerts",
    description: "A card you follow is listed for sale.",
    prefKey: "listing",
  },
  {
    id: "price",
    title: "Price alerts",
    description: "A card on your watchlist moves in price.",
    prefKey: "price",
  },
  {
    id: "market",
    title: "Market updates",
    description: "Weekly index summary.",
    prefKey: "market",
  },
  {
    id: "news",
    title: "Product news & drops",
    description: "Occasional product news and events.",
    marketing: true,
  },
];

const DEFAULT_PREFS: EmailNotifPrefs = {
  trades: true,
  bids: true,
  price: true,
  vault: true,
  listing: true,
  market: false,
};

type PendingSave = {
  prefs: EmailNotifPrefs;
  marketingEmailsOptIn: boolean;
};

function mergePrefs(user: AuthUser): EmailNotifPrefs {
  return { ...DEFAULT_PREFS, ...user.emailNotifPrefs };
}

export function SettingsNotificationsSection({ user }: { user: AuthUser }) {
  const setUser = useAuthStore((s) => s.setUser);
  const [prefs, setPrefs] = useState<EmailNotifPrefs>(() => mergePrefs(user));
  const [marketingEmailsOptIn, setMarketingEmailsOptIn] = useState(
    user.marketingEmailsOptIn ?? false,
  );
  const [accountToggles, setAccountToggles] = useState(DEFAULT_ACCOUNT_TOGGLES);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<PendingSave | null>(null);
  const saveChain = useRef(Promise.resolve());
  const committed = useRef<PendingSave>({
    prefs: mergePrefs(user),
    marketingEmailsOptIn: user.marketingEmailsOptIn ?? false,
  });
  const setUserRef = useRef(setUser);
  setUserRef.current = setUser;

  const applyAllAlertsOffUi = useCallback(() => {
    setAccountToggles(ALL_OFF_ACCOUNT_TOGGLES);
    setPrefs((prev) => ({ ...prev, ...ALL_OFF_OPTIONAL_PREFS }));
    setMarketingEmailsOptIn(false);
  }, []);

  useEffect(() => {
    if (readEmailUnsubscribeUiActive(user.email)) {
      applyAllAlertsOffUi();
    }
    const onUnsubscribed = () => {
      if (readEmailUnsubscribeUiActive(user.email)) applyAllAlertsOffUi();
    };
    window.addEventListener(EMAIL_UNSUBSCRIBE_UI_EVENT, onUnsubscribed);
    return () => window.removeEventListener(EMAIL_UNSUBSCRIBE_UI_EVENT, onUnsubscribed);
  }, [user.email, applyAllAlertsOffUi]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const payload = pending.current;
      pending.current = null;
      if (!payload) return;
      void updateAuthProfile({
        emailNotifPrefs: payload.prefs,
        marketingEmailsOptIn: payload.marketingEmailsOptIn,
      })
        .then((u) => setUserRef.current(u))
        .catch(() => undefined);
    };
  }, []);

  function persist(next: PendingSave) {
    saveChain.current = saveChain.current.then(async () => {
      const previous = committed.current;
      try {
        const u = await updateAuthProfile({
          emailNotifPrefs: next.prefs,
          marketingEmailsOptIn: next.marketingEmailsOptIn,
        });
        committed.current = {
          prefs: mergePrefs(u),
          marketingEmailsOptIn: u.marketingEmailsOptIn ?? next.marketingEmailsOptIn,
        };
        setUser(u);
        setSaveError(null);
      } catch (e) {
        setPrefs(previous.prefs);
        setMarketingEmailsOptIn(previous.marketingEmailsOptIn);
        setSaveError(e instanceof Error ? e.message : "Could not save preferences.");
      }
    });
  }

  function scheduleSave(next: PendingSave) {
    pending.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const payload = pending.current;
      pending.current = null;
      if (payload) persist(payload);
    }, 350);
  }

  function isOptionalOn(row: (typeof OPTIONAL_ROWS)[number]): boolean {
    if (row.marketing) return marketingEmailsOptIn;
    if (row.prefKey) return prefs[row.prefKey];
    return false;
  }

  function clearUnsubscribeUiIfTurningOn(nextOn: boolean) {
    if (nextOn) clearEmailUnsubscribeUi();
  }

  function toggleAccount(rowId: AccountRowId) {
    const nextOn = !accountToggles[rowId];
    clearUnsubscribeUiIfTurningOn(nextOn);
    setAccountToggles((prev) => ({ ...prev, [rowId]: nextOn }));
  }

  function toggleOptional(row: (typeof OPTIONAL_ROWS)[number]) {
    if (row.marketing) {
      const nextMarketing = !marketingEmailsOptIn;
      clearUnsubscribeUiIfTurningOn(nextMarketing);
      setMarketingEmailsOptIn(nextMarketing);
      scheduleSave({ prefs, marketingEmailsOptIn: nextMarketing });
      return;
    }
    if (!row.prefKey) return;
    const nextOn = !prefs[row.prefKey];
    clearUnsubscribeUiIfTurningOn(nextOn);
    const nextPrefs = { ...prefs, [row.prefKey]: nextOn };
    setPrefs(nextPrefs);
    scheduleSave({ prefs: nextPrefs, marketingEmailsOptIn });
  }

  return (
    <section className="tk-settings__sec">
      <h1 className="tk-settings__sec-h">Notifications</h1>
      <p className="tk-settings__sec-sub">How Tokenable reaches you.</p>
      <p className="tk-settings__sec-sub !mt-1.5">
        You get these by email. Everything also appears in your notification center while
        you&apos;re signed in.
      </p>

      <div className="tk-settings__lbl !mt-[22px] !mb-2.5">Account &amp; transactions</div>
      <div className="tk-settings__card">
        {ACCOUNT_ROWS.map((row) => {
          const on = accountToggles[row.id];
          return (
            <div key={row.id} className="tk-settings__row">
              <div>
                <div className="tk-settings__row-t">{row.title}</div>
                <div className="tk-settings__row-d">{row.description}</div>
              </div>
              <button
                type="button"
                className={cn("tk-settings__sw", on && "on")}
                aria-label={row.title}
                aria-pressed={on}
                onClick={() => toggleAccount(row.id)}
              />
            </div>
          );
        })}
      </div>

      <div className="tk-settings__lbl !mt-[22px] !mb-2.5">Optional alerts</div>
      <div className="tk-settings__card">
        {OPTIONAL_ROWS.map((row) => {
          const on = isOptionalOn(row);
          return (
            <div key={row.id} className="tk-settings__row">
              <div>
                <div className="tk-settings__row-t">{row.title}</div>
                <div className="tk-settings__row-d">{row.description}</div>
              </div>
              <button
                type="button"
                className={cn("tk-settings__sw", on && "on")}
                aria-label={row.title}
                aria-pressed={on}
                onClick={() => toggleOptional(row)}
              />
            </div>
          );
        })}
      </div>

      {saveError ? (
        <p className="text-xs text-[var(--warn)]" role="status">
          {saveError}
        </p>
      ) : null}
    </section>
  );
}
