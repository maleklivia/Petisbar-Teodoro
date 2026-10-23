BEGIN;

ALTER TABLE cashback_ledger ADD COLUMN IF NOT EXISTS customer_account_id uuid REFERENCES customer_accounts(id);
CREATE UNIQUE INDEX IF NOT EXISTS cashback_credit_order_uq ON cashback_ledger(order_id) WHERE entry_type='credito';
CREATE INDEX IF NOT EXISTS cashback_ledger_account_idx ON cashback_ledger(customer_account_id, created_at);

COMMIT;
