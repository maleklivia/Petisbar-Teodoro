BEGIN;

-- Reuse the canonical discount_percent field for choice-based combos.
ALTER TABLE promotions DROP CONSTRAINT IF EXISTS promotions_check1;
ALTER TABLE promotions ADD CONSTRAINT promotions_check1 CHECK (
  (rule_type='percentage' AND discount_percent IS NOT NULL AND discount_amount IS NULL AND combo_price IS NULL)
  OR (rule_type='fixed' AND discount_percent IS NULL AND discount_amount IS NOT NULL AND combo_price IS NULL)
  OR (rule_type='combo' AND discount_amount IS NULL AND (discount_percent IS NULL OR combo_price IS NULL))
);

-- Explicit business decision by Lívia on 22/10/2026. Preserve groups and history.
WITH previous AS (
  SELECT id,code,combo_price,discount_percent,description FROM promotions
  WHERE code='COMBO-BATATA-RECHEADA' AND rule_type='combo'
    AND (combo_price IS NOT NULL OR discount_percent IS DISTINCT FROM 5) FOR UPDATE
), changed AS (
  UPDATE promotions SET combo_price=NULL,discount_percent=5,
    description='Escolha 2 batatas recheadas e 1 refrigerante. Ganhe 5% de desconto sobre os itens e opções escolhidos, com os preços atuais do cardápio.',updated_at=now()
  WHERE id IN (SELECT id FROM previous) RETURNING id
)
INSERT INTO audit_logs(action,entity_type,entity_id,metadata)
SELECT 'promotion.pricing.change','promotion',previous.id::text,
  jsonb_build_object('reason','Lívia aprovou 5% sobre os itens escolhidos em 22/10/2026','before',to_jsonb(previous),'discountPercent',5,'source','migration 027')
FROM previous JOIN changed USING(id);

COMMIT;
