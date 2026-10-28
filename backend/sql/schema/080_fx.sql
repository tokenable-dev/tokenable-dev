-- Display FX and saved language/currency preferences.
-- Rates are the latest ECB observation only. USDC settlement does not read this table.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_locale varchar(16),
  ADD COLUMN IF NOT EXISTS preferred_currency varchar(8);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_preferred_locale_check;
ALTER TABLE users
  ADD CONSTRAINT users_preferred_locale_check
  CHECK (preferred_locale IS NULL OR preferred_locale IN ('en', 'zh-CN', 'ja', 'zh-TW'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_preferred_currency_check;
ALTER TABLE users
  ADD CONSTRAINT users_preferred_currency_check
  CHECK (
    preferred_currency IS NULL
    OR preferred_currency IN (
      'USD', 'EUR', 'GBP', 'KRW', 'JPY', 'SGD', 'CAD', 'AUD', 'CHF', 'HKD', 'CNY',
      'IDR', 'MYR', 'PHP', 'VND', 'THB'
    )
  );

COMMENT ON COLUMN users.preferred_locale IS
  'Saved UI language: en, zh-CN, ja, zh-TW. Null until the user saves a preference.';
COMMENT ON COLUMN users.preferred_currency IS
  'Display currency for USD reference prices. Does not change USDC settlement.';

CREATE TABLE IF NOT EXISTS fx_rates (
  currency varchar(8) PRIMARY KEY,
  quote_per_usd numeric(20, 8) NOT NULL,
  observation_date date NOT NULL,
  source varchar(32) NOT NULL,
  fetched_at timestamptz NOT NULL,
  CONSTRAINT fx_rates_quote_positive CHECK (quote_per_usd > 0)
);

COMMENT ON TABLE fx_rates IS
  'Latest ECB reference rate per display currency. quote_per_usd is foreign units per 1 USD. No history.';
