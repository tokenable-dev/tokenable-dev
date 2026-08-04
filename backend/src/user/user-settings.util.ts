export type EmailNotifPrefs = {
  trades: boolean;
  bids: boolean;
  price: boolean;
  vault: boolean;
};

export const DEFAULT_EMAIL_NOTIF_PREFS: EmailNotifPrefs = {
  trades: true,
  bids: true,
  price: true,
  vault: true,
};

export function normalizeEmailNotifPrefs(
  input: Partial<EmailNotifPrefs> | null | undefined,
  base: EmailNotifPrefs = DEFAULT_EMAIL_NOTIF_PREFS,
): EmailNotifPrefs {
  return {
    trades: typeof input?.trades === 'boolean' ? input.trades : base.trades,
    bids: typeof input?.bids === 'boolean' ? input.bids : base.bids,
    price: typeof input?.price === 'boolean' ? input.price : base.price,
    vault: typeof input?.vault === 'boolean' ? input.vault : base.vault,
  };
}

export const MAX_SHIPPING_ADDRESSES_PER_USER = 10;
