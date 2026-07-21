BEGIN;

CREATE SEQUENCE IF NOT EXISTS order_number_seq;
SELECT setval('order_number_seq', COALESCE((SELECT MAX(order_number) FROM orders), 0) + 1, false);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fulfillment_type text NOT NULL DEFAULT 'retirada',
  ADD COLUMN IF NOT EXISTS delivery_address jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
