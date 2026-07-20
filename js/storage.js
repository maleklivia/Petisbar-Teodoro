/* ============================================================
   Petisbar Teodoro — Storage
   Estado local temporário enquanto o backend não está conectado.
   ============================================================ */

const STORE_KEY = 'distrito-os-v5'; // compatibilidade com instalações existentes

const seedData = {
  settings: {
    restaurantName: 'Petisbar Teodoro',
    cmvGoal: 35,
    currency: 'BRL',
    version: '0.4.0',
  },
  products: [],
  stock: [],
  orders: [],
  finance: [],
  clients: [],
  fornecedores: [],
  campaigns: [],
};

const Storage = {
  getState() {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(seedData);

    try {
      const parsed = JSON.parse(raw);
      parsed.products ??= [];
      parsed.stock ??= [];
      parsed.orders ??= [];
      parsed.finance ??= [];
      parsed.clients ??= [];
      parsed.fornecedores ??= [];
      parsed.campaigns ??= [];
      parsed.settings ??= structuredClone(seedData.settings);
      if (['Distrito XVII', 'Distrito OS'].includes(parsed.settings.restaurantName)) {
        parsed.settings.restaurantName = 'Petisbar Teodoro';
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(parsed));
      return parsed;
    } catch {
      return structuredClone(seedData);
    }
  },

  setState(state) {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  },

  resetState() {
    localStorage.removeItem(STORE_KEY);
    return structuredClone(seedData);
  },
};
