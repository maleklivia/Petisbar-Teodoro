BEGIN;

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS purchase_type text NOT NULL DEFAULT 'manual';

COMMIT;
