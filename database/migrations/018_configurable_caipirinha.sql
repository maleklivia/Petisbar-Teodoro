BEGIN;

-- O sabor é escolhido no pedido. Os SKUs antigos continuam disponíveis
-- para preço, ficha técnica e histórico, sem cartões duplicados no cardápio.
UPDATE products
SET name = 'Caipirinha',
    description = 'Caipirinha 500ml com cachaça 51, açúcar e gelo. Escolha limão, morango ou maracujá.',
    active = true,
    updated_at = now()
WHERE id = 'p-drk001';

UPDATE products SET active = false, updated_at = now()
WHERE id IN ('p-drk002', 'p-drk003');

COMMIT;
