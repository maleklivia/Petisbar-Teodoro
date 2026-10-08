BEGIN;

-- O SKU P passa a representar o item configurável. O SKU G permanece para
-- preço e histórico de pedidos, mas deixa de aparecer como produto separado.
UPDATE products
SET name = 'Batata Frita',
    description = 'Batata frita sequinha e crocante. Escolha P (300g) ou G (500g).',
    active = true,
    updated_at = now()
WHERE id = 'p-pet001';

UPDATE products SET active = false, updated_at = now() WHERE id = 'p-pet006';

COMMIT;
