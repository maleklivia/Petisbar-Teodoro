ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS fulfillment_type text
  CHECK (fulfillment_type IS NULL OR fulfillment_type IN ('retirada','entrega'));

-- The whisky option for the two Copão sizes is pickup-only. Keep this rule in
-- the canonical product option data as well as in server-side validation.
UPDATE products AS product
SET option_groups = (
  SELECT jsonb_agg(
    CASE WHEN option_group->>'key'='beverage' THEN
      jsonb_set(option_group,'{options}',(
        SELECT jsonb_agg(
          CASE WHEN option->>'value'='whisky'
            THEN jsonb_set(option,'{fulfillmentType}','"retirada"'::jsonb,true)
            ELSE option END
          ORDER BY option_index
        )
        FROM jsonb_array_elements(option_group->'options') WITH ORDINALITY AS options(option,option_index)
      ),true)
    ELSE option_group END
    ORDER BY group_index
  )
  FROM jsonb_array_elements(product.option_groups) WITH ORDINALITY AS groups(option_group,group_index)
)
WHERE product.id IN ('p-drk010','p-drk011')
  AND jsonb_typeof(product.option_groups)='array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(product.option_groups) AS group_data(option_group)
    WHERE group_data.option_group->>'key'='beverage'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(group_data.option_group->'options') AS option_data(option)
        WHERE option_data.option->>'value'='whisky'
      )
  );
