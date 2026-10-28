# Display exchange rates

Public read of the latest ECB reference rates. Used only to convert USD catalog and valuation amounts in the UI. USDC balances, Seaport consideration, and settlement amounts do not read this endpoint. Those USDC amounts are shown as `$` at 1 USDC = $1. The symbol is presentation only. It is not an FX conversion and not a USDC/USD market rate.

## `GET /api/fx/rates`

No authentication.

```json
{
  "base": "USD",
  "source": "frankfurter-ecb",
  "observationDate": "2026-10-26",
  "fetchedAt": "2026-10-27T15:30:00.000Z",
  "stale": false,
  "rates": { "USD": 1, "EUR": 0.89381, "KRW": 1325.28 }
}
```

`rates[code]` is foreign-currency units per 1 USD. Display amount = `usdAmount * rates[currency]`.

The provider is Frankfurter's ECB feed (`/v2/providers/ecb/rates?base=USD`). A weekend or holiday request returns the previous observation date. The cron keeps the last successful rows when a fetch fails.

`stale` is true when the observation date is more than five calendar days old, or when no rates have been stored. The UI still shows a converted amount if a rate exists, and does not add a rate-date or staleness note. If the selected currency has no rate, the UI shows the USD amount and does not invent one.

Historical chart points use this same latest rate. They are not historical exchange rates. The chart does not show an estimate note.

Prices use the currency’s own symbol and do not append the ISO code: `A$ 142`, `C$ 140`, `S$ 128`, `HK$ 784`, `CN¥ 712`, `Rp 1,816,300`, `RM 409`, `₱6,394`, `₫2,585,800`, `฿3,381`. A one-character symbol stays against the number (`$100`, `₩132,528`). Chinese yuan uses `CN¥` so the header chip is distinct from Japanese yen `¥`. Every display currency is rounded to a whole unit. Cents are not shown.

ECB publishes CAD, AUD, CNY, IDR, MYR, PHP, and THB. It does not publish VND. That one rate is read from Frankfurter’s Bank Negara Malaysia feed (`/v2/providers/bnm/rates?base=USD&quotes=VND`) and stored on its own row. If that fetch fails, the ECB snapshot is still published and a VND selection with no stored rate falls back to USD.

### Refresh

`@nestjs/schedule`, twice a day in UTC: 15:30 (after the ECB 16:00 CET publication) and 01:00. One Postgres advisory lock (`710271001`). No Redis cache.

If a process does not get the lock, it waits until the lock is free and then reloads `fx_rates`. It does not keep serving its previous memory after a peer has written. A published snapshot includes every allowlisted quote from a single observation date. A partial or mixed-date read does not replace the last complete snapshot. A failed fetch does not delete stored rows.

Existing databases apply this through `backend/sql/maintenance/deploy-sync.sql` (the `080_fx.sql` section). Do not re-run `010_users_and_auth.sql` on a database that already has `users`.

### Storage

`fx_rates`: one row per currency (`quote_per_usd`, `observation_date`, `source`, `fetched_at`). No history table.

Guest currency is the `tk_currency` cookie. Signed-in users store `users.preferred_currency`. A saved profile wins over a disagreeing cookie. Language is independent: `tk_locale` / `users.preferred_locale` is `en`, `zh-CN`, `ja`, or `zh-TW`. A saved profile locale wins over a disagreeing cookie. Invalid locales fall back to `en`.

## `POST /api/fx/catalog-names`

No authentication. Display-only translations for catalog phrases that are not an official Pokemon species name: leftover card-name words, set names, and variants. Number, grade, and stored rows are not modified. `collection_key` is not modified.

```json
{ "locale": "ja", "texts": ["Monkey D. Luffy"] }
```

```json
{ "translations": { "Monkey D. Luffy": "モンキー・D・ルフィ" } }
```

`locale` is `ja`, `zh-CN`, or `zh-TW`. At most 40 strings, each at most 180 characters. Results stay in process memory on the API. A failed lookup returns the source string for that entry. English is not requested; the UI keeps the source string.
