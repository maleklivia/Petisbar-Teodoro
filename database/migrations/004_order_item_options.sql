BEGIN;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
