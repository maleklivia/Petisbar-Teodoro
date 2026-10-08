BEGIN;

-- Transcription of the purchased course recipes. These records are a separate,
-- non-operational workbench: importing them never replaces a live product sheet,
-- changes a sale price, or creates a stock movement.
CREATE TABLE IF NOT EXISTS recipe_cards (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  recipe_type text NOT NULL CHECK (recipe_type IN ('preparation','product')),
  name text NOT NULL,
  product_id text REFERENCES products(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('incomplete','draft','ready')),
  output_yield numeric(14,3) CHECK (output_yield IS NULL OR output_yield > 0),
  output_unit text,
  packaging_capacity numeric(14,3) CHECK (packaging_capacity IS NULL OR packaging_capacity > 0),
  packaging_capacity_unit text,
  preparation_method text NOT NULL DEFAULT '',
  pending_notes text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'Método Batatona’s — e-books liberados em 07/10/2026',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipe_cards_type_status_idx ON recipe_cards(recipe_type,status,code);
CREATE INDEX IF NOT EXISTS recipe_cards_product_idx ON recipe_cards(product_id) WHERE product_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS recipe_card_items (
  id text PRIMARY KEY,
  recipe_id text NOT NULL REFERENCES recipe_cards(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  item_name text NOT NULL,
  ingredient_id text REFERENCES ingredients(id) ON DELETE RESTRICT,
  preparation_id text REFERENCES recipe_cards(id) ON DELETE RESTRICT,
  quantity numeric(14,3) CHECK (quantity IS NULL OR quantity > 0),
  unit text,
  is_packaging boolean NOT NULL DEFAULT false,
  pending_note text NOT NULL DEFAULT '',
  UNIQUE (recipe_id,sort_order),
  CHECK (ingredient_id IS NULL OR preparation_id IS NULL),
  CHECK (quantity IS NOT NULL OR length(pending_note) > 0)
);

CREATE INDEX IF NOT EXISTS recipe_card_items_recipe_idx ON recipe_card_items(recipe_id,sort_order);
CREATE INDEX IF NOT EXISTS recipe_card_items_preparation_idx ON recipe_card_items(preparation_id) WHERE preparation_id IS NOT NULL;

COMMIT;
