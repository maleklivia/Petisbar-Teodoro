export const ORDER_STATUSES = [
  'Novo',
  'Aguardando Pagamento',
  'Pago',
  'Confirmado',
  'Em Produção',
  'Pronto',
  'Saiu para Entrega',
  'Entregue',
  'Concluído',
  'Cancelado',
];

const transitions = new Map([
  ['Novo', ['Aguardando Pagamento', 'Pago', 'Confirmado', 'Em Produção', 'Cancelado']],
  ['Aguardando Pagamento', ['Pago', 'Cancelado']],
  ['Pago', ['Em Produção', 'Cancelado']],
  ['Confirmado', ['Em Produção', 'Cancelado']],
  ['Em Produção', ['Pronto', 'Cancelado']],
  ['Pronto', ['Saiu para Entrega', 'Entregue', 'Concluído', 'Cancelado']],
  ['Saiu para Entrega', ['Entregue', 'Concluído', 'Cancelado']],
  ['Entregue', ['Cancelado']],
  ['Concluído', ['Cancelado']],
  ['Cancelado', []],
]);

const statusRank = new Map([
  ['Novo', 0],
  ['Aguardando Pagamento', 1],
  ['Pago', 2],
  ['Confirmado', 2],
  ['Em Produção', 3],
  ['Pronto', 4],
  ['Saiu para Entrega', 5],
  ['Entregue', 6],
  ['Concluído', 6],
]);

export const isCompletedStatus = status => status === 'Entregue' || status === 'Concluído';

export function canTransitionOrder(currentStatus, nextStatus, { external = false } = {}) {
  if (currentStatus === nextStatus) return true;
  if (!ORDER_STATUSES.includes(nextStatus) || currentStatus === 'Cancelado') return false;
  if (external) {
    if (nextStatus === 'Cancelado') return true;
    return (statusRank.get(nextStatus) ?? -1) >= (statusRank.get(currentStatus) ?? 0);
  }
  return transitions.get(currentStatus)?.includes(nextStatus) || false;
}

const unitFactors = {
  g: { g: 1, kg: 0.001 },
  kg: { g: 1000, kg: 1 },
  ml: { ml: 1, L: 0.001 },
  L: { ml: 1000, L: 1 },
};

export function convertQuantity(quantity, fromUnit, toUnit) {
  if (fromUnit === toUnit) return quantity;
  const factor = unitFactors[fromUnit]?.[toUnit];
  if (factor === undefined) {
    const error = new Error(`Unidades incompatíveis: ${fromUnit} → ${toUnit}`);
    error.code = 'incompatible_units';
    error.statusCode = 409;
    throw error;
  }
  return quantity * factor;
}
