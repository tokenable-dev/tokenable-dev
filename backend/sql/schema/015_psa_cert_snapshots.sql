-- psa_cert_snapshots — PSA Public API cache keyed by cert digits (not collection bucket)
-- Entity: backend/src/marketplace/entities/psa-cert-snapshot.entity.ts

CREATE TABLE IF NOT EXISTS psa_cert_snapshots (
  cert_number varchar(32) PRIMARY KEY,
  snapshot_json jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE psa_cert_snapshots IS
  'PSA Public API PSACert body cache; shared across collections that reference the same cert.';
