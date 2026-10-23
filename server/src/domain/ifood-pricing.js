export function suggestedIfoodPrice(price, feePercent = 26.2) {
  const amount = Number(price);
  const fee = Number(feePercent);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(fee) || fee < 0 || fee >= 100) {
    throw new RangeError('Invalid iFood price inputs');
  }
  return Math.ceil((amount / (1 - fee / 100)) * 100) / 100;
}

export function resolveIfoodPrice({ newSalePrice, submittedIfoodPrice, currentSalePrice, currentIfoodPrice }, feePercent = 26.2) {
  const hasCurrentPrice = currentIfoodPrice !== undefined && currentIfoodPrice !== null;
  const isCurrentPriceSuggested = hasCurrentPrice
    && Math.round(Number(currentIfoodPrice) * 100)
      === Math.round(suggestedIfoodPrice(currentSalePrice, feePercent) * 100);

  if (submittedIfoodPrice !== undefined && submittedIfoodPrice !== null) {
    const submittedMatchesCurrent = hasCurrentPrice
      && Math.round(Number(submittedIfoodPrice) * 100) === Math.round(Number(currentIfoodPrice) * 100);
    // Older browser tabs submit the visible field even when it was never edited.
    if (!isCurrentPriceSuggested || !submittedMatchesCurrent) return Number(submittedIfoodPrice);
  }

  return !hasCurrentPrice || isCurrentPriceSuggested
    ? suggestedIfoodPrice(newSalePrice, feePercent)
    : Number(currentIfoodPrice);
}
