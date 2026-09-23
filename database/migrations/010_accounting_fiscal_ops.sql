BEGIN;
ALTER TABLE fiscal_documents ADD COLUMN IF NOT EXISTS counterparty_name text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS counterparty_tax_id text NOT NULL DEFAULT '';
ALTER TABLE fiscal_documents DROP CONSTRAINT IF EXISTS fiscal_documents_created_by_fkey;
ALTER TABLE fiscal_documents ALTER COLUMN created_by TYPE uuid USING NULL::uuid;
ALTER TABLE fiscal_documents ADD CONSTRAINT fiscal_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);
CREATE INDEX IF NOT EXISTS fiscal_documents_issue_date_idx ON fiscal_documents(issue_date DESC);
CREATE INDEX IF NOT EXISTS tax_obligations_due_date_idx ON tax_obligations(due_date DESC);
INSERT INTO permissions(code,description) VALUES ('accounting.read','Consultar contábil e fiscal'),('accounting.write','Alterar dados contábeis e fiscais') ON CONFLICT(code) DO NOTHING;
INSERT INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.name='admin' AND p.code IN ('accounting.read','accounting.write') ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.name='gerente' AND p.code='accounting.read' ON CONFLICT DO NOTHING;
COMMIT;

