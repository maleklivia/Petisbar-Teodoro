BEGIN;

ALTER TABLE customer_accounts
  ADD COLUMN IF NOT EXISTS client_id text REFERENCES clients(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customer_accounts_client_idx
  ON customer_accounts(client_id) WHERE client_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_login_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_login_challenges_active_idx
  ON customer_login_challenges(customer_account_id, expires_at)
  WHERE consumed_at IS NULL;

COMMIT;
