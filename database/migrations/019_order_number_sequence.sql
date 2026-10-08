BEGIN;

-- Pedidos importados com número explícito podem deixar a sequência para trás.
SELECT setval(
  'order_number_seq',
  GREATEST(
    COALESCE((SELECT MAX(order_number) FROM orders), 0) + 1,
    (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM order_number_seq)
  ),
  false
);

COMMIT;
