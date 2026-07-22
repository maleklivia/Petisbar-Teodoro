BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS ifood_price numeric(12,2) CHECK (ifood_price IS NULL OR ifood_price >= 0),
  ADD COLUMN IF NOT EXISTS ifood_active boolean NOT NULL DEFAULT false;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS external_order_id text,
  ADD COLUMN IF NOT EXISTS external_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS orders_external_order_id_idx
  ON orders(external_order_id) WHERE external_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ifood_events (
  id text PRIMARY KEY,
  code text NOT NULL,
  order_id text,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

COMMIT;
