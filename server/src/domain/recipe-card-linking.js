function normalizeName(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR');
}

/** Resolve an unlinked recipe row only when its exact name identifies one canonical component. */
export function resolveRecipeComponentLink(item, { ingredients = [], preparations = [] } = {}) {
  if (item.ingredientId || item.preparationId) return { ...item };

  const name = normalizeName(item.itemName);
  if (!name) return { ...item };

  const candidates = [
    ...ingredients.map(row => ({ type: 'ingredient', row })),
    ...preparations.map(row => ({ type: 'preparation', row })),
  ].filter(candidate => normalizeName(candidate.row.name) === name);

  if (candidates.length !== 1) return { ...item };

  const [{ type, row }] = candidates;
  return type === 'ingredient'
    ? { ...item, ingredientId: row.id, isPackaging: row.category?.toLocaleLowerCase('pt-BR') === 'embalagens' }
    : { ...item, preparationId: row.id };
}
