CREATE TABLE IF NOT EXISTS cost_history (
  id text PRIMARY KEY,
  ingredient_id text REFERENCES ingredients(id) ON DELETE CASCADE,
  product_id text REFERENCES products(id) ON DELETE CASCADE,
  purchase_id text NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
  purchase_item_id text NOT NULL REFERENCES purchase_items(id) ON DELETE RESTRICT,
  unit_cost numeric(14,6) NOT NULL CHECK (unit_cost >= 0),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL,
  is_initial_base boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cost_history_one_owner CHECK ((ingredient_id IS NOT NULL) <> (product_id IS NOT NULL),
  CONSTRAINT cost_history_unique_item UNIQUE (purchase_item_id)
);

CREATE INDEX IF NOT EXISTS cost_history_ingredient_date_idx ON cost_history (ingredient_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS cost_history_product_date_idx ON cost_history (product_id, recorded_at DESC);
