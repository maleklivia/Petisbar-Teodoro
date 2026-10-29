BEGIN;

-- A tabela customer_accounts só é criada na migration 017. A coluna pode ser
-- criada aqui, mas o vínculo é aplicado depois, quando a tabela existir.
ALTER TABLE cashback_ledger ADD COLUMN IF NOT EXISTS customer_account_id uuid;
DO $$
BEGIN
  IF to_regclass('customer_accounts') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid='cashback_ledger'::regclass
        AND conname='cashback_ledger_customer_account_id_fkey'
    ) THEN
    ALTER TABLE cashback_ledger
      ADD CONSTRAINT cashback_ledger_customer_account_id_fkey
      FOREIGN KEY (customer_account_id) REFERENCES customer_accounts(id);
  END IF;
END $$;
ALTER TABLE cashback_ledger ALTER COLUMN client_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cashback_credit_order_uq ON cashback_ledger(order_id) WHERE entry_type='credito';
CREATE INDEX IF NOT EXISTS cashback_ledger_account_idx ON cashback_ledger(customer_account_id, created_at);

COMMIT;
