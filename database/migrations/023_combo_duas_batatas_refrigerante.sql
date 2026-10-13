BEGIN;

-- Atualiza a regra existente sem alterar pedidos nem preços de produtos.
UPDATE promotions
SET name='Combo Duas Batatas Recheadas + Refrigerante',
    description='Escolha 2 batatas recheadas ativas (iguais ou de sabores diferentes) e 1 refrigerante. Acréscimos de escolha aparecem no total.',
    combo_price=57.76,
    updated_at=now()
WHERE code='COMBO-BATATA-RECHEADA' AND rule_type='combo';

UPDATE promotion_groups g
SET name='Batatas recheadas', required_quantity=2, max_quantity=2,
    allow_same_product=true, active=true
FROM promotions p
WHERE g.promotion_id=p.id AND p.code='COMBO-BATATA-RECHEADA' AND g.code='batata';

-- Inclui qualquer batata recheada ativa cadastrada, preservando os acréscimos
-- já existentes e calculando somente os que ainda não estavam configurados.
WITH potato_prices AS (
  SELECT id,sale_price,MIN(sale_price) OVER () AS min_price
  FROM products WHERE active=true AND category='BATATAS RECHEADAS'
)
INSERT INTO promotion_group_products(group_id,product_id,surcharge)
SELECT g.id,p.id,GREATEST(0,p.sale_price-p.min_price)
FROM promotion_groups g JOIN promotions pr ON pr.id=g.promotion_id
CROSS JOIN potato_prices p
WHERE pr.code='COMBO-BATATA-RECHEADA' AND g.code='batata'
ON CONFLICT(group_id,product_id) DO NOTHING;

INSERT INTO promotion_groups(promotion_id,code,name,required_quantity,max_quantity,allow_same_product,active)
SELECT id,'refrigerante','Refrigerante',1,1,false,true
FROM promotions WHERE code='COMBO-BATATA-RECHEADA' AND rule_type='combo'
ON CONFLICT(promotion_id,code) DO UPDATE SET
  name=EXCLUDED.name,required_quantity=1,max_quantity=1,allow_same_product=false,active=true;

INSERT INTO promotion_group_products(group_id,product_id,surcharge)
SELECT g.id,p.id,0
FROM promotion_groups g JOIN promotions pr ON pr.id=g.promotion_id
JOIN products p ON p.active=true AND p.category='Refrigerantes'
WHERE pr.code='COMBO-BATATA-RECHEADA' AND g.code='refrigerante'
ON CONFLICT(group_id,product_id) DO NOTHING;

INSERT INTO audit_logs(action,entity_type,entity_id,metadata)
SELECT 'promotion.combo_reconfigured','promotion',id::text,
  jsonb_build_object('code',code,'name',name,'comboPrice',combo_price,
    'groups',jsonb_build_array(
      jsonb_build_object('code','batata','requiredQuantity',2,'maxQuantity',2,'allowSameProduct',true),
      jsonb_build_object('code','refrigerante','requiredQuantity',1,'maxQuantity',1)
    ),'reason','duas batatas recheadas e um refrigerante')
FROM promotions WHERE code='COMBO-BATATA-RECHEADA';

COMMIT;
