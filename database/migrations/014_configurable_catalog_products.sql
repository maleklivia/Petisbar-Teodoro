BEGIN;

-- Consolida os tamanhos em um único item configurável e preserva os SKUs antigos
-- como inativos para manter o histórico de pedidos.
UPDATE products
SET name = 'Batata com Cheddar e Bacon',
    description = 'Batata com cheddar e bacon em tamanho P (400g) ou G (700g), com opção de adicionar bebida',
    sale_price = 27.90,
    active = true,
    updated_at = now()
WHERE id = 'p-pet002';

UPDATE products SET active = false, updated_at = now() WHERE id = 'p-pet007';

UPDATE products
SET name = 'Copão',
    description = 'Copão personalizável de 500ml ou 700ml com vodka ou whisky, energético e gelo saborizado',
    active = true,
    updated_at = now()
WHERE id = 'p-drk010';

UPDATE products SET active = false, updated_at = now() WHERE id = 'p-drk011';

UPDATE products
SET name = 'Refrigerante lata',
    description = 'Refrigerante lata 350ml: escolha Coca-Cola, Guaraná Antarctica ou Sprite',
    sale_price = 5.00,
    active = true,
    updated_at = now()
WHERE id = 'p-ref001';

UPDATE products SET active = false, updated_at = now() WHERE id IN ('p-ref002', 'p-ref003');

COMMIT;
