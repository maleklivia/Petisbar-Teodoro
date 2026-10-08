BEGIN;

INSERT INTO permissions (code, description) VALUES
  ('promotions.read', 'Consultar promoções e combos'),
  ('promotions.write', 'Criar, editar e ativar promoções e combos')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('promotions.read','promotions.write')
WHERE r.name IN ('admin','gerente') ON CONFLICT DO NOTHING;

CREATE TABLE promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '',
  rule_type text NOT NULL CHECK (rule_type IN ('percentage','fixed','combo')),
  discount_percent numeric(5,2) CHECK (discount_percent IS NULL OR discount_percent BETWEEN 0.01 AND 100),
  discount_amount numeric(12,2) CHECK (discount_amount IS NULL OR discount_amount > 0),
  combo_price numeric(12,2) CHECK (combo_price IS NULL OR combo_price >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer NOT NULL DEFAULT 100,
  stack_with_coupon boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at),
  CHECK ((rule_type='percentage' AND discount_percent IS NOT NULL AND discount_amount IS NULL AND combo_price IS NULL)
    OR (rule_type='fixed' AND discount_percent IS NULL AND discount_amount IS NOT NULL AND combo_price IS NULL)
    OR (rule_type='combo' AND discount_percent IS NULL AND discount_amount IS NULL))
);
CREATE INDEX promotions_active_period_idx ON promotions(active, starts_at, ends_at, priority DESC);

CREATE TABLE promotion_products (
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products(id),
  PRIMARY KEY (promotion_id, product_id)
);

CREATE TABLE promotion_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[a-z0-9_-]{1,40}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  required_quantity integer NOT NULL CHECK (required_quantity BETWEEN 1 AND 30),
  max_quantity integer NOT NULL CHECK (max_quantity BETWEEN 1 AND 30),
  allow_same_product boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  allowed_options jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(allowed_options)='object'),
  UNIQUE(promotion_id, code),
  CHECK (max_quantity >= required_quantity)
);

CREATE TABLE promotion_group_products (
  group_id uuid NOT NULL REFERENCES promotion_groups(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES products(id),
  surcharge numeric(12,2) NOT NULL DEFAULT 0 CHECK (surcharge >= 0),
  allowed_options jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(allowed_options)='object'),
  PRIMARY KEY (group_id, product_id)
);

ALTER TABLE orders ADD COLUMN promotion_discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (promotion_discount >= 0);
ALTER TABLE orders ADD COLUMN coupon_discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (coupon_discount >= 0);
ALTER TABLE orders ADD COLUMN coupon_code text;
ALTER TABLE order_items ADD COLUMN list_unit_price numeric(12,2) CHECK (list_unit_price IS NULL OR list_unit_price >= 0);
ALTER TABLE order_items ADD COLUMN promotion_discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (promotion_discount >= 0);
ALTER TABLE order_items ADD COLUMN promotion_application_id uuid;
ALTER TABLE order_items ADD COLUMN combo_group_id uuid REFERENCES promotion_groups(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN combo_group_name text;

CREATE TABLE promotion_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  promotion_id uuid REFERENCES promotions(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('percentage','fixed','combo')),
  discount_amount numeric(12,2) NOT NULL CHECK (discount_amount >= 0),
  normal_subtotal numeric(12,2) NOT NULL CHECK (normal_subtotal >= 0),
  applied_subtotal numeric(12,2) NOT NULL CHECK (applied_subtotal >= 0),
  item_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(item_snapshot)='array'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE order_items ADD CONSTRAINT order_items_promotion_application_fk
  FOREIGN KEY (promotion_application_id) REFERENCES promotion_applications(id) ON DELETE SET NULL;

-- Reserva lógica para impedir sobre-venda sem gravar movimento ou baixar saldo.
CREATE TABLE order_stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id text REFERENCES products(id),
  ingredient_id text REFERENCES ingredients(id),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','consumed','released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(product_id,ingredient_id)=1)
);
CREATE UNIQUE INDEX order_stock_reservations_product_idx ON order_stock_reservations(order_id,product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX order_stock_reservations_ingredient_idx ON order_stock_reservations(order_id,ingredient_id) WHERE ingredient_id IS NOT NULL;
CREATE INDEX order_stock_reservations_open_product_idx ON order_stock_reservations(product_id) WHERE status='reserved' AND product_id IS NOT NULL;
CREATE INDEX order_stock_reservations_open_ingredient_idx ON order_stock_reservations(ingredient_id) WHERE status='reserved' AND ingredient_id IS NOT NULL;
CREATE INDEX promotion_applications_order_idx ON promotion_applications(order_id);
CREATE INDEX promotion_applications_promotion_idx ON promotion_applications(promotion_id, created_at DESC);

CREATE TABLE public_order_idempotency (
  idempotency_key uuid PRIMARY KEY,
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  order_id text UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((order_id IS NULL)=(response IS NULL))
);

-- Quatro rascunhos comerciais. Categorias e produtos permitidos são derivados
-- do catálogo ativo na implantação, sem inventar preço nem ativar regras.
INSERT INTO promotions (code,name,description,rule_type,active,priority) VALUES
  ('COMBO-DUPLA-CERVEJAS','Combo Dupla de Cervejas','Escolha 2 cervejas entre Brahma, Skol e Budweiser.','combo',false,100),
  ('COMBO-PETISCO-BEBIDA','Combo Petisco + Bebida','Escolha 1 petisco ou item de conveniência e 1 refrigerante ou água.','combo',false,100),
  ('COMBO-CAIPIRINHA-DOBRO','Combo Caipirinha em Dobro','Escolha 2 caipirinhas de 500 ml entre os sabores disponíveis.','combo',false,100),
  ('COMBO-BATATA-RECHEADA','Combo Batata Recheada','Escolha uma batata recheada ativa.','combo',false,100)
ON CONFLICT (code) DO NOTHING;

INSERT INTO promotion_groups (promotion_id,code,name,required_quantity,max_quantity,allow_same_product)
SELECT id,'bebidas','Bebidas',2,2,true FROM promotions WHERE code='COMBO-DUPLA-CERVEJAS'
ON CONFLICT (promotion_id,code) DO NOTHING;
INSERT INTO promotion_group_products (group_id,product_id)
SELECT g.id,p.id FROM promotion_groups g CROSS JOIN products p
WHERE g.code='bebidas' AND g.promotion_id=(SELECT id FROM promotions WHERE code='COMBO-DUPLA-CERVEJAS')
  AND p.active AND p.category='Cervejas' AND p.name ILIKE ANY(ARRAY['%Brahma%','%Skol%','%Budweiser%'])
ON CONFLICT DO NOTHING;

INSERT INTO promotion_groups (promotion_id,code,name,required_quantity,max_quantity,allow_same_product)
SELECT id,'petisco','Petisco ou conveniência',1,1,false FROM promotions WHERE code='COMBO-PETISCO-BEBIDA'
ON CONFLICT (promotion_id,code) DO NOTHING;
INSERT INTO promotion_group_products (group_id,product_id)
SELECT g.id,p.id FROM promotion_groups g CROSS JOIN products p
WHERE g.code='petisco' AND g.promotion_id=(SELECT id FROM promotions WHERE code='COMBO-PETISCO-BEBIDA')
  AND p.active AND p.category IN ('Petiscos','Conveniência') ON CONFLICT DO NOTHING;
INSERT INTO promotion_groups (promotion_id,code,name,required_quantity,max_quantity,allow_same_product)
SELECT id,'bebida','Refrigerante ou água',1,1,false FROM promotions WHERE code='COMBO-PETISCO-BEBIDA'
ON CONFLICT (promotion_id,code) DO NOTHING;
INSERT INTO promotion_group_products (group_id,product_id)
SELECT g.id,p.id FROM promotion_groups g CROSS JOIN products p
WHERE g.code='bebida' AND g.promotion_id=(SELECT id FROM promotions WHERE code='COMBO-PETISCO-BEBIDA')
  AND p.active AND p.category IN ('Refrigerantes','Águas') ON CONFLICT DO NOTHING;

INSERT INTO promotion_groups (promotion_id,code,name,required_quantity,max_quantity,allow_same_product,allowed_options)
SELECT id,'drinks','Caipirinhas 500 ml',2,2,true,'{"flavor":["natural","morango","maracuja"]}'::jsonb
FROM promotions WHERE code='COMBO-CAIPIRINHA-DOBRO' ON CONFLICT (promotion_id,code) DO NOTHING;
INSERT INTO promotion_group_products (group_id,product_id,allowed_options)
SELECT g.id,p.id,'{"flavor":["natural","morango","maracuja"]}'::jsonb
FROM promotion_groups g JOIN products p ON p.id='p-drk001' AND p.active
WHERE g.code='drinks' AND g.promotion_id=(SELECT id FROM promotions WHERE code='COMBO-CAIPIRINHA-DOBRO')
ON CONFLICT DO NOTHING;

INSERT INTO promotion_groups (promotion_id,code,name,required_quantity,max_quantity,allow_same_product)
SELECT id,'batata','Batata recheada',1,1,false FROM promotions WHERE code='COMBO-BATATA-RECHEADA'
ON CONFLICT (promotion_id,code) DO NOTHING;
INSERT INTO promotion_group_products (group_id,product_id)
SELECT g.id,p.id FROM promotion_groups g CROSS JOIN products p
WHERE g.code='batata' AND g.promotion_id=(SELECT id FROM promotions WHERE code='COMBO-BATATA-RECHEADA')
  AND p.active AND p.category='BATATAS RECHEADAS' ON CONFLICT DO NOTHING;

COMMIT;
