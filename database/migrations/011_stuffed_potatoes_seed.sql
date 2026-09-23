-- Linha BATATAS RECHEADAS. Idempotente: não duplica insumos/produtos existentes.
BEGIN;

INSERT INTO ingredients (id, sku, name, category, unit, unit_cost, active)
SELECT v.id, v.sku, v.name, v.category, v.unit, v.unit_cost, true
FROM (VALUES
  ('i-033','INS033','Batata Inglesa','Hortifruti','kg',5.00::numeric),
  ('i-034','INS034','Leite Integral','Laticínios','L',5.50::numeric),
  ('i-035','INS035','Manteiga','Laticínios','kg',45.00::numeric),
  ('i-036','INS036','Muçarela','Laticínios','kg',40.00::numeric),
  ('i-037','INS037','Requeijão Cremoso','Laticínios','kg',28.00::numeric),
  ('i-038','INS038','Peito de Frango','Carnes','kg',21.00::numeric),
  ('i-039','INS039','Creme de Leite','Laticínios','kg',15.00::numeric),
  ('i-040','INS040','Ketchup','Insumos','kg',12.00::numeric),
  ('i-041','INS041','Mostarda','Insumos','kg',14.00::numeric),
  ('i-042','INS042','Embalagem Batata Recheada 400/500 ml','Embalagens','un',1.20::numeric)
 ,('i-043','INS043','Batata Palha','Insumos','kg',28.00::numeric)
 ,('i-044','INS044','Carne Seca','Carnes','kg',55.00::numeric)
) AS v(id,sku,name,category,unit,unit_cost)
WHERE NOT EXISTS (SELECT 1 FROM ingredients i WHERE lower(i.name)=lower(v.name));

INSERT INTO products (id, sku, name, category, description, sale_price, active, preparation_minutes, current_stock)
VALUES
 ('p-br001','BATREC001','Batata de Frango Cremoso — 400g','BATATAS RECHEADAS','Purê de batata cremoso, frango temperado, requeijão e muçarela gratinada.',27.90,true,15,NULL),
 ('p-br002','BATREC002','Batata de Calabresa Acebolada — 400g','BATATAS RECHEADAS','Purê de batata cremoso, calabresa acebolada, requeijão e muçarela gratinada.',27.90,true,15,NULL),
 ('p-br003','BATREC003','Batata Bacon & Cheddar — 400g','BATATAS RECHEADAS','Purê de batata cremoso, bacon crocante, cheddar cremoso e muçarela gratinada.',29.90,true,15,NULL),
 ('p-br004','BATREC004','Batata Strogonoff de Frango — 400g','BATATAS RECHEADAS','Purê de batata cremoso com strogonoff de frango, muçarela gratinada e batata palha.',29.90,true,15,NULL),
 ('p-br005','BATREC005','Batata de Carne Seca Cremosa — 400g','BATATAS RECHEADAS','Purê de batata cremoso, carne seca desfiada, requeijão e muçarela gratinada.',34.90,true,15,NULL)
ON CONFLICT (id) DO UPDATE SET category=EXCLUDED.category, description=EXCLUDED.description, sale_price=EXCLUDED.sale_price, active=true;

INSERT INTO technical_sheets (id, product_id, yield)
VALUES ('f-br001','p-br001',1),('f-br002','p-br002',1),('f-br003','p-br003',1),('f-br004','p-br004',1),('f-br005','p-br005',1)
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO technical_sheet_items (sheet_id, ingredient_id, quantity, unit)
SELECT x.sheet_id, i.id, x.quantity, x.unit
FROM (VALUES
 ('f-br001','Batata Inglesa',250,'g'),('f-br001','Leite Integral',40,'ml'),('f-br001','Manteiga',10,'g'),('f-br001','Peito de Frango',80,'g'),('f-br001','Requeijão Cremoso',25,'g'),('f-br001','Muçarela',35,'g'),('f-br001','Sal',2,'g'),('f-br001','Embalagem Batata Recheada 400/500 ml',1,'un'),('f-br001','Guardanapo',2,'un'),
 ('f-br002','Batata Inglesa',250,'g'),('f-br002','Leite Integral',40,'ml'),('f-br002','Manteiga',10,'g'),('f-br002','Calabresa',80,'g'),('f-br002','Cebola',25,'g'),('f-br002','Requeijão Cremoso',20,'g'),('f-br002','Muçarela',35,'g'),('f-br002','Sal',2,'g'),('f-br002','Embalagem Batata Recheada 400/500 ml',1,'un'),('f-br002','Guardanapo',2,'un'),
 ('f-br003','Batata Inglesa',250,'g'),('f-br003','Leite Integral',40,'ml'),('f-br003','Manteiga',10,'g'),('f-br003','Bacon em Cubos',60,'g'),('f-br003','Cheddar Cremoso',40,'g'),('f-br003','Muçarela',35,'g'),('f-br003','Sal',2,'g'),('f-br003','Embalagem Batata Recheada 400/500 ml',1,'un'),('f-br003','Guardanapo',2,'un'),
 ('f-br004','Batata Inglesa',250,'g'),('f-br004','Leite Integral',40,'ml'),('f-br004','Manteiga',10,'g'),('f-br004','Peito de Frango',80,'g'),('f-br004','Creme de Leite',30,'g'),('f-br004','Ketchup',10,'g'),('f-br004','Mostarda',5,'g'),('f-br004','Muçarela',30,'g'),('f-br004','Batata Palha',15,'g'),('f-br004','Sal',2,'g'),('f-br004','Embalagem Batata Recheada 400/500 ml',1,'un'),('f-br004','Guardanapo',2,'un'),
 ('f-br005','Batata Inglesa',250,'g'),('f-br005','Leite Integral',40,'ml'),('f-br005','Manteiga',10,'g'),('f-br005','Carne Seca',80,'g'),('f-br005','Cebola',20,'g'),('f-br005','Requeijão Cremoso',25,'g'),('f-br005','Muçarela',35,'g'),('f-br005','Sal',2,'g'),('f-br005','Embalagem Batata Recheada 400/500 ml',1,'un'),('f-br005','Guardanapo',2,'un')
) AS x(sheet_id, ingredient_name, quantity, unit)
JOIN ingredients i ON lower(i.name)=lower(x.ingredient_name)
ON CONFLICT (sheet_id, ingredient_id) DO NOTHING;
COMMIT;

