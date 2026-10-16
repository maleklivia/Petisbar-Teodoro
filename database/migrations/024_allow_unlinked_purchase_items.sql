BEGIN;

-- Rascunhos importados de pedidos online podem não ter vínculo de catálogo ainda.
-- O vínculo continua exclusivo (ingrediente OU produto), quando informado.
ALTER TABLE purchase_items
  DROP CONSTRAINT IF EXISTS purchase_items_single_item_check;

ALTER TABLE purchase_items
  ADD CONSTRAINT purchase_items_single_item_check
  CHECK (num_nonnulls(ingredient_id, product_id) <= 1) NOT VALID;

ALTER TABLE purchase_items
  VALIDATE CONSTRAINT purchase_items_single_item_check;

COMMIT;
