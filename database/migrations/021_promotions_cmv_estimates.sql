BEGIN;

ALTER TABLE promotions
  ADD COLUMN cmv_estimate_percent numeric(5,2)
    CHECK (cmv_estimate_percent IS NULL OR cmv_estimate_percent BETWEEN 0.01 AND 99.00);

-- Estimates use the ERP's default 35% CMV goal as an explicit proxy because
-- these products have no complete cost records yet. Sale prices remain canonical.
UPDATE promotions SET
  combo_price = CASE code
    WHEN 'COMBO-DUPLA-CERVEJAS' THEN 11.40
    WHEN 'COMBO-PETISCO-BEBIDA' THEN 19.90
    WHEN 'COMBO-CAIPIRINHA-DOBRO' THEN 30.20
    WHEN 'COMBO-BATATA-RECHEADA' THEN 26.50
  END,
  cmv_estimate_percent = 35.00,
  description = CASE code
    WHEN 'COMBO-DUPLA-CERVEJAS' THEN 'Escolha 2 cervejas entre Brahma e Budweiser. Acréscimos de escolha aparecem no total. Skol ainda não está cadastrada como produto ativo.'
    WHEN 'COMBO-PETISCO-BEBIDA' THEN 'Escolha 1 petisco e 1 refrigerante ou água. O total varia conforme os itens e opções selecionados.'
    WHEN 'COMBO-CAIPIRINHA-DOBRO' THEN 'Escolha 2 caipirinhas de 500 ml entre os sabores disponíveis. Confirmação de maioridade obrigatória.'
    WHEN 'COMBO-BATATA-RECHEADA' THEN 'Escolha 1 batata recheada ativa. Acréscimos de escolha aparecem no total.'
  END,
  active = false,
  stack_with_coupon = false,
  updated_at = now()
WHERE code IN ('COMBO-DUPLA-CERVEJAS','COMBO-PETISCO-BEBIDA','COMBO-CAIPIRINHA-DOBRO','COMBO-BATATA-RECHEADA');

-- Product substitutions carry only the difference from the cheapest choice in
-- their group. Option price differences (size/flavor/add-on) are handled by the
-- server from current canonical sale prices at checkout.
UPDATE promotion_group_products gp SET surcharge = CASE
  WHEN p.code='COMBO-DUPLA-CERVEJAS' AND gp.product_id='p-bee005' THEN 2.00
  WHEN p.code='COMBO-PETISCO-BEBIDA' AND g.code='petisco' AND gp.product_id='p-pet002' THEN 10.00
  WHEN p.code='COMBO-PETISCO-BEBIDA' AND g.code='petisco' AND gp.product_id='p-pet003' THEN 19.00
  WHEN p.code='COMBO-PETISCO-BEBIDA' AND g.code='petisco' AND gp.product_id='p-pet004' THEN 27.00
  WHEN p.code='COMBO-PETISCO-BEBIDA' AND g.code='petisco' AND gp.product_id='p-pet005' THEN 32.00
  WHEN p.code='COMBO-PETISCO-BEBIDA' AND g.code='bebida' AND gp.product_id='p-agu002' THEN 1.00
  WHEN p.code='COMBO-PETISCO-BEBIDA' AND g.code='bebida' AND gp.product_id='p-ref001' THEN 2.00
  WHEN p.code='COMBO-BATATA-RECHEADA' AND gp.product_id IN ('p-br003','p-br004') THEN 2.00
  WHEN p.code='COMBO-BATATA-RECHEADA' AND gp.product_id='p-br005' THEN 7.00
  ELSE 0.00
END
FROM promotion_groups g JOIN promotions p ON p.id=g.promotion_id
WHERE gp.group_id=g.id AND p.code IN ('COMBO-DUPLA-CERVEJAS','COMBO-PETISCO-BEBIDA','COMBO-CAIPIRINHA-DOBRO','COMBO-BATATA-RECHEADA');

INSERT INTO audit_logs(action,entity_type,entity_id,metadata)
SELECT 'promotion.estimate_configured','promotion',id::text,
  jsonb_build_object('code',code,'comboPrice',combo_price,'cmvEstimatePercent',cmv_estimate_percent,'source','migration 021; based on 35% default CMV target')
FROM promotions
WHERE code IN ('COMBO-DUPLA-CERVEJAS','COMBO-PETISCO-BEBIDA','COMBO-CAIPIRINHA-DOBRO','COMBO-BATATA-RECHEADA');

COMMIT;
