-- Base contábil/fiscal configurável. Os valores do MEI não substituem a validação do contador.
CREATE TABLE IF NOT EXISTS accounting_accounts (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('ativo','passivo','receita','despesa','patrimonio')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fiscal_documents (
  id text PRIMARY KEY,
  document_type text NOT NULL CHECK (document_type IN ('entrada','saida','servico')),
  document_number text NOT NULL DEFAULT '',
  series text NOT NULL DEFAULT '',
  issue_date date NOT NULL,
  issuer_tax_id text NOT NULL DEFAULT '',
  issuer_name text NOT NULL DEFAULT '',
  recipient_tax_id text NOT NULL DEFAULT '',
  recipient_name text NOT NULL DEFAULT '',
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  xml_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','validado','cancelado')),
  notes text NOT NULL DEFAULT '',
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tax_obligations (
  id text PRIMARY KEY,
  competence date NOT NULL,
  obligation_type text NOT NULL CHECK (obligation_type IN ('das_mei','dasn_simei','relatorio_receita_bruta')),
  due_date date NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','paga','transmitida','cancelada')),
  receipt_number text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competence, obligation_type)
);

INSERT INTO accounting_accounts (id, code, name, account_type) VALUES
 ('acc-caixa','1.1.01','Caixa','ativo'), ('acc-banco','1.1.02','Bancos','ativo'),
 ('acc-receita-vendas','3.1.01','Receita de vendas','receita'),
 ('acc-cmv','4.1.01','Custo das mercadorias vendidas','despesa'),
 ('acc-despesas-operacionais','4.2.01','Despesas operacionais','despesa'),
 ('acc-das-mei','4.2.02','DAS-MEI','despesa')
ON CONFLICT (id) DO NOTHING;
