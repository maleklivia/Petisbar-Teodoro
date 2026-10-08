BEGIN;

-- Consolida Coca-Cola, Guaraná e Sprite em um item configurável,
-- preservando os SKUs antigos como inativos para manter o histórico.
UPDATE products
SET name = 'Refrigerante lata',
    description = 'Refrigerante lata 350ml: escolha Coca-Cola, Guaraná Antarctica ou Sprite',
    sale_price = 5.00,
    active = true,
    updated_at = now()
WHERE id = 'p-ref001';

UPDATE products
SET active = false,
    updated_at = now()
WHERE id IN ('p-ref002', 'p-ref003');

COMMIT;
