BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number text;

CREATE TABLE IF NOT EXISTS cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by uuid REFERENCES users(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_amount numeric(12,2) NOT NULL DEFAULT 0,
  expected_amount numeric(12,2),
  counted_amount numeric(12,2),
  notes text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('entrada','saida')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'livre' CHECK (status IN ('livre','ocupada','inativa')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  vehicle text NOT NULL DEFAULT '',
  available boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  active boolean NOT NULL DEFAULT false,
  cashback_percent numeric(5,2) NOT NULL DEFAULT 5 CHECK (cashback_percent BETWEEN 0 AND 30),
  expires_in_days integer NOT NULL DEFAULT 30 CHECK (expires_in_days BETWEEN 1 AND 365),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cashback_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES clients(id),
  order_id text REFERENCES orders(id),
  entry_type text NOT NULL CHECK (entry_type IN ('credito','uso','expiracao','ajuste')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_scheduled_for_idx ON orders(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS cashback_ledger_client_idx ON cashback_ledger(client_id, created_at);

COMMIT;
