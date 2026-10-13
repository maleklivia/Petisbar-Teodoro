BEGIN;

-- The course names two alternatives for chicken, while the stock catalog has
-- one canonical chicken breast item. Preserve the source wording and link only
-- these stable, unchanged seed rows to the unique canonical inventory items.
UPDATE recipe_card_items item
SET ingredient_id = ingredient.id,
    pending_note = ''
FROM ingredients ingredient
WHERE item.id = 'course-base-02-item-1'
  AND item.recipe_id = 'course-base-02'
  AND item.item_name = 'Frango sassami ou filé de peito'
  AND item.ingredient_id IS NULL
  AND item.preparation_id IS NULL
  AND lower(ingredient.name) = 'peito de frango'
  AND (SELECT count(*) FROM ingredients WHERE lower(name) = 'peito de frango') = 1;

UPDATE recipe_card_items item
SET ingredient_id = ingredient.id,
    pending_note = 'Pesar a unidade usada; peso não informado.'
FROM ingredients ingredient
WHERE item.id = 'course-base-02-item-2'
  AND item.recipe_id = 'course-base-02'
  AND item.item_name = 'Cebola média/grande'
  AND item.ingredient_id IS NULL
  AND item.preparation_id IS NULL
  AND lower(ingredient.name) = 'cebola'
  AND (SELECT count(*) FROM ingredients WHERE lower(name) = 'cebola') = 1;

COMMIT;
