BEGIN;

CREATE TABLE IF NOT EXISTS order_payments (
  id text PRIMARY KEY,
  order_id text NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_order_id text,
  provider_payment_id text,
  method text NOT NULL,
  status text NOT NULL,
  status_detail text NOT NULL DEFAULT '',
  gross_amount numeric(12,2) NOT NULL CHECK (gross_amount >= 0),
  fee_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  net_amount numeric(12,2) NOT NULL DEFAULT 0,
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_payments_provider_order_idx ON order_payments(provider, provider_order_id);

COMMIT;
