BEGIN;
CREATE TABLE IF NOT EXISTS business_documents (
  id text PRIMARY KEY,title text NOT NULL,category text NOT NULL,
  expires_on date,link text NOT NULL DEFAULT '',notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) CHECK(discount_amount IS NULL OR discount_amount>0);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_uses integer CHECK(max_uses IS NULL OR max_uses>0);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

-- Reconcile the preparation-link schema already present in the deployed DB.
ALTER TABLE technical_sheet_items ADD COLUMN IF NOT EXISTS id bigserial;
ALTER TABLE technical_sheet_items ADD COLUMN IF NOT EXISTS preparation_id text REFERENCES recipe_cards(id) ON DELETE RESTRICT;
ALTER TABLE technical_sheet_items ALTER COLUMN ingredient_id DROP NOT NULL;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='technical_sheet_items'::regclass AND contype='p' AND pg_get_constraintdef(oid)='PRIMARY KEY (sheet_id, ingredient_id)') THEN
    ALTER TABLE technical_sheet_items DROP CONSTRAINT technical_sheet_items_pkey;
    ALTER TABLE technical_sheet_items ADD PRIMARY KEY(id);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='technical_sheet_items'::regclass AND conname='technical_sheet_items_one_component') THEN
    ALTER TABLE technical_sheet_items ADD CONSTRAINT technical_sheet_items_one_component CHECK((ingredient_id IS NOT NULL)<>(preparation_id IS NOT NULL));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS technical_sheet_items_ingredient_unique ON technical_sheet_items(sheet_id,ingredient_id);
CREATE UNIQUE INDEX IF NOT EXISTS technical_sheet_items_preparation_unique ON technical_sheet_items(sheet_id,preparation_id);
CREATE INDEX IF NOT EXISTS technical_sheet_items_preparation_idx ON technical_sheet_items(preparation_id);
COMMIT;
