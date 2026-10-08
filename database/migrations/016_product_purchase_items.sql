BEGIN;

ALTER TABLE purchase_items
  ADD COLUMN IF NOT EXISTS product_id text REFERENCES products(id);

ALTER TABLE purchase_items
  ADD CONSTRAINT purchase_items_single_item_check
  CHECK (num_nonnulls(ingredient_id, product_id) = 1) NOT VALID;

ALTER TABLE purchase_items
  VALIDATE CONSTRAINT purchase_items_single_item_check;

CREATE INDEX IF NOT EXISTS purchase_items_product_idx ON purchase_items(product_id)
  WHERE product_id IS NOT NULL;

COMMIT;
