BEGIN;

-- Contas de clientes são deliberadamente separadas de users (equipe do ERP)
-- e de clients (cadastro operacional legado do ERP).
CREATE TABLE IF NOT EXISTS customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_normalized text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  google_subject text,
  email_verified_at timestamptz,
  anonymized_at timestamptz,
  retention_until date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_accounts_email_normalized_check CHECK (length(email_normalized) >= 3),
  CONSTRAINT customer_accounts_google_subject_check CHECK (google_subject IS NULL OR length(google_subject) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_accounts_email_normalized_idx
  ON customer_accounts(email_normalized);
CREATE UNIQUE INDEX IF NOT EXISTS customer_accounts_google_subject_idx
  ON customer_accounts(google_subject) WHERE google_subject IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id uuid REFERENCES customer_accounts(id) ON DELETE SET NULL,
  request_type text NOT NULL CHECK (request_type IN ('access', 'correction', 'deletion', 'anonymization')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'completed', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  notes text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS customer_data_requests_account_idx ON customer_data_requests(customer_account_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS customer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  ip inet,
  user_agent text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_sessions_active_idx
  ON customer_sessions(customer_account_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  street text NOT NULL DEFAULT '',
  number text NOT NULL DEFAULT '',
  district text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  complement text NOT NULL DEFAULT '',
  reference text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_addresses_account_idx ON customer_addresses(customer_account_id);
CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_default_idx
  ON customer_addresses(customer_account_id) WHERE is_default;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_account_id uuid REFERENCES customer_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_customer_account_idx ON orders(customer_account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  previous_status text,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'system',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_status_history_order_idx
  ON order_status_history(order_id, created_at);

-- Preserva o estado atual dos pedidos antigos sem inventar transições históricas.
INSERT INTO order_status_history (order_id, status, source, created_at)
SELECT o.id, o.status, 'migration', o.created_at
FROM orders o
WHERE NOT EXISTS (
  SELECT 1 FROM order_status_history h WHERE h.order_id = o.id
);

CREATE TABLE IF NOT EXISTS order_tracking_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_tracking_tokens_order_idx ON order_tracking_tokens(order_id);
CREATE INDEX IF NOT EXISTS order_tracking_tokens_active_idx
  ON order_tracking_tokens(token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS order_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key_hash text NOT NULL UNIQUE,
  request_hash text NOT NULL,
  order_id text UNIQUE REFERENCES orders(id) ON DELETE SET NULL,
  customer_account_id uuid REFERENCES customer_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS order_idempotency_expiry_idx ON order_idempotency_keys(expires_at);

COMMIT;
