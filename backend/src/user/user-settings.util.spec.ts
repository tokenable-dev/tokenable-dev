import {
  DEFAULT_EMAIL_NOTIF_PREFS,
  normalizeEmailNotifPrefs,
} from './user-settings.util';

describe('normalizeEmailNotifPrefs', () => {
  it('fills missing keys from defaults', () => {
    expect(normalizeEmailNotifPrefs({ trades: false })).toEqual({
      trades: false,
      bids: true,
      price: true,
      vault: true,
    });
  });

  it('merges onto an existing base', () => {
    expect(
      normalizeEmailNotifPrefs(
        { price: false },
        { ...DEFAULT_EMAIL_NOTIF_PREFS, bids: false },
      ),
    ).toEqual({
      trades: true,
      bids: false,
      price: false,
      vault: true,
    });
  });

  it('ignores non-boolean values', () => {
    expect(
      normalizeEmailNotifPrefs({
        trades: 'no' as unknown as boolean,
        vault: false,
      }),
    ).toEqual({
      ...DEFAULT_EMAIL_NOTIF_PREFS,
      vault: false,
    });
  });
});
