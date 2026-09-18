-- Drop leftover tables with no TypeORM entity and no live write path.
-- Safe to re-run. Does not touch portfolio_holdings (hiddenAt is the current hide flag).

DROP TABLE IF EXISTS public.psa_cert_snapshots;
DROP TABLE IF EXISTS public.portfolio_hidden_holdings;
DROP TABLE IF EXISTS public.verification_tokens;
DROP TYPE IF EXISTS public.verification_token_type;
