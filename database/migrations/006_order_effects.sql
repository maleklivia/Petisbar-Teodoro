BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS effects_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS effects_reversed_at timestamptz;

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS product_id text REFERENCES products(id);

ALTER TABLE stock_movements
  ALTER COLUMN ingredient_id DROP NOT NULL;

ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_single_item_check
  CHECK (num_nonnulls(ingredient_id, product_id) = 1) NOT VALID;

ALTER TABLE stock_movements
  VALIDATE CONSTRAINT stock_movements_single_item_check;

ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS effect_key text;

CREATE UNIQUE INDEX IF NOT EXISTS financial_entries_effect_key_idx
  ON financial_entries(effect_key) WHERE effect_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS stock_movements_reference_idx
  ON stock_movements(reference);

COMMIT;
