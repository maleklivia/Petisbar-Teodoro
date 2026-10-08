BEGIN;

-- Preços canônicos das opções do refrigerante. Os itens inativos ficam
-- editáveis no ERP e não aparecem como produtos separados ao cliente.
INSERT INTO products (id, name, category, description, sale_price, active)
VALUES
  ('p-ref003', 'Sprite 350ml (opção)', 'Refrigerantes', 'Preço da opção Sprite no refrigerante lata', 5.00, false),
  ('p-ref005', 'Coca-Cola 350ml (opção)', 'Refrigerantes', 'Preço da opção Coca-Cola no refrigerante lata', 6.00, false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
