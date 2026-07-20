/* ============================================================
   Petisbar Teodoro — Storage
   Toda persistência passa por aqui. Quando o backend chegar,
   apenas api.js muda — storage.js continua sendo a fonte
   de verdade para o estado local (cache, offline, etc.).
   ============================================================ */

const STORE_KEY = 'distrito-os-v5'; // manter compatibilidade com dados existentes
const AUTH_KEY  = 'distrito-os-auth';

/* ── Seed Data ────────────────────────────────────────────────── */
const seedData = {
  settings: {
    restaurantName: 'Petisbar Teodoro',
    cmvGoal: 35,
    currency: 'BRL',
    version: '0.1.0',
  },

  products: [
    { id: 1, name: 'Batata Cheddar',   category: 'Batatas',   price: 38,  cost: 11,  sold: 34 },
    { id: 2, name: 'Batata Bacon',     category: 'Batatas',   price: 42,  cost: 13,  sold: 28 },
    { id: 3, name: 'Batata Completa',  category: 'Batatas',   price: 48,  cost: 15,  sold: 19 },
    { id: 4, name: 'Bolinho de Aipim', category: 'Aperitivos', price: 32, cost: 8,   sold: 22 },
    { id: 5, name: 'Caldo Verde',      category: 'Caldos',    price: 28,  cost: 7,   sold: 15 },
    { id: 6, name: 'Caldo de Costela', category: 'Caldos',    price: 35,  cost: 9,   sold: 11 },
    { id: 7, name: 'Frango na Brasa',  category: 'Pratos',    price: 52,  cost: 17,  sold: 9  },
    { id: 8, name: 'Costela Assada',   category: 'Pratos',    price: 68,  cost: 22,  sold: 6  },
    { id: 9, name: 'Combo Família',    category: 'Combos',    price: 89,  cost: 27,  sold: 14 },
    { id:10, name: 'Refrigerante',     category: 'Bebidas',   price: 8,   cost: 3,   sold: 41 },
  ],

  stock: [
    { id: 1,  name: 'Batata Palito',      unit: 'kg',  quantity: 12, min: 5  },
    { id: 2,  name: 'Cheddar Cremoso',    unit: 'kg',  quantity: 1.5,min: 3  }, // LOW
    { id: 3,  name: 'Bacon Fatiado',      unit: 'kg',  quantity: 0.8,min: 2  }, // LOW
    { id: 4,  name: 'Aipim',              unit: 'kg',  quantity: 6,  min: 3  },
    { id: 5,  name: 'Repolho',            unit: 'kg',  quantity: 3,  min: 2  },
    { id: 6,  name: 'Frango',             unit: 'kg',  quantity: 5,  min: 3  },
    { id: 7,  name: 'Costela Bovina',     unit: 'kg',  quantity: 2,  min: 4  }, // LOW
    { id: 8,  name: 'Caixa Delivery',     unit: 'un',  quantity: 62, min: 20 },
    { id: 9,  name: 'Sacola Kraft',       unit: 'un',  quantity: 85, min: 30 },
    { id: 10, name: 'Adesivo Petisbar Teodoro',   unit: 'un',  quantity: 90, min: 40 },
    { id: 11, name: 'Gás P13',            unit: 'un',  quantity: 2,  min: 1  },
    { id: 12, name: 'Refrigerante 350ml', unit: 'un',  quantity: 36, min: 12 },
  ],

  orders: [
    { id: '#017', product: 'Batata Cheddar',   qty: 2, total: 76,  client: 'Ana Lima',      status: 'Pedido finalizado',      date: '2026-07-09' },
    { id: '#016', product: 'Combo Família',    qty: 1, total: 89,  client: 'Carlos Matos',   status: 'Saiu para entrega',      date: '2026-07-09' },
    { id: '#015', product: 'Batata Bacon',     qty: 1, total: 42,  client: 'Fernanda Costa', status: 'Em produção',            date: '2026-07-09' },
    { id: '#014', product: 'Caldo Verde',      qty: 2, total: 56,  client: 'João Souza',     status: 'Aguardando pagamento',   date: '2026-07-09' },
    { id: '#013', product: 'Batata Completa',  qty: 1, total: 48,  client: 'Marina Pires',   status: 'Pedido finalizado',      date: '2026-07-08' },
    { id: '#012', product: 'Frango na Brasa',  qty: 1, total: 52,  client: 'Pedro Alves',    status: 'Pedido finalizado',      date: '2026-07-08' },
    { id: '#011', product: 'Bolinho de Aipim', qty: 2, total: 64,  client: 'Lúcia Ferreira', status: 'Pedido finalizado',      date: '2026-07-07' },
    { id: '#010', product: 'Combo Família',    qty: 1, total: 89,  client: 'Roberto Nunes',  status: 'Pedido finalizado',      date: '2026-07-07' },
    { id: '#009', product: 'Caldo de Costela', qty: 1, total: 35,  client: 'Patrícia Reis',  status: 'Pedido finalizado',      date: '2026-07-06' },
    { id: '#008', product: 'Batata Cheddar',   qty: 3, total: 114, client: 'Thiago Lima',    status: 'Pedido finalizado',      date: '2026-07-05' },
  ],

  finance: [
    { id: 1,  date: '2026-07-09', description: 'Vendas do dia · 09/07',       category: 'Vendas',        type: 'Entrada', value:  840 },
    { id: 2,  date: '2026-07-08', description: 'Vendas do dia · 08/07',       category: 'Vendas',        type: 'Entrada', value: 1240 },
    { id: 3,  date: '2026-07-07', description: 'Vendas do dia · 07/07',       category: 'Vendas',        type: 'Entrada', value:  980 },
    { id: 4,  date: '2026-07-06', description: 'Vendas do dia · 06/07',       category: 'Vendas',        type: 'Entrada', value:  760 },
    { id: 5,  date: '2026-07-05', description: 'Vendas do dia · 05/07',       category: 'Vendas',        type: 'Entrada', value: 1480 },
    { id: 6,  date: '2026-07-04', description: 'Vendas do dia · 04/07',       category: 'Vendas',        type: 'Entrada', value: 1120 },
    { id: 7,  date: '2026-07-03', description: 'Vendas do dia · 03/07',       category: 'Vendas',        type: 'Entrada', value:  890 },
    { id: 8,  date: '2026-07-02', description: 'Vendas do dia · 02/07',       category: 'Vendas',        type: 'Entrada', value:  680 },
    { id: 9,  date: '2026-07-01', description: 'Vendas do dia · 01/07',       category: 'Vendas',        type: 'Entrada', value:  520 },
    { id: 10, date: '2026-07-07', description: 'CMV · Batata Cheddar',        category: 'CMV',           type: 'Saída',   value: -380 },
    { id: 11, date: '2026-07-06', description: 'CMV · Combo Família',         category: 'CMV',           type: 'Saída',   value: -270 },
    { id: 12, date: '2026-07-05', description: 'CMV · Batata Bacon',          category: 'CMV',           type: 'Saída',   value: -260 },
    { id: 13, date: '2026-07-04', description: 'CMV · Frango na Brasa',       category: 'CMV',           type: 'Saída',   value: -170 },
    { id: 14, date: '2026-07-03', description: 'CMV · Bolinho de Aipim',      category: 'CMV',           type: 'Saída',   value: -176 },
    { id: 15, date: '2026-07-02', description: 'Frigorífico São Jorge',        category: 'Fornecedores',  type: 'Saída',   value: -680 },
    { id: 16, date: '2026-07-01', description: 'Distribuidora Cheddar+',      category: 'Fornecedores',  type: 'Saída',   value: -440 },
    { id: 17, date: '2026-07-01', description: 'Aluguel · Julho',             category: 'Fixo',          type: 'Saída',   value: -800 },
    { id: 18, date: '2026-07-03', description: 'Supra Hortifrutti',           category: 'Fornecedores',  type: 'Saída',   value: -280 },
    { id: 19, date: '2026-07-05', description: 'Gás P13 × 2',                category: 'Operacional',   type: 'Saída',   value: -160 },
  ],

  clients: [
    { id: 1, name: 'Ana Lima',       phone: '(11) 98001-0001', orders: 12, totalSpent: 912,  lastPurchase: '2026-07-09', favorite: 'Batata Cheddar'   },
    { id: 2, name: 'Carlos Matos',   phone: '(11) 98001-0002', orders: 8,  totalSpent: 712,  lastPurchase: '2026-07-09', favorite: 'Combo Família'    },
    { id: 3, name: 'Fernanda Costa', phone: '(11) 98001-0003', orders: 6,  totalSpent: 504,  lastPurchase: '2026-07-09', favorite: 'Batata Bacon'     },
    { id: 4, name: 'João Souza',     phone: '(11) 98001-0004', orders: 9,  totalSpent: 630,  lastPurchase: '2026-07-09', favorite: 'Caldo Verde'      },
    { id: 5, name: 'Marina Pires',   phone: '(11) 98001-0005', orders: 5,  totalSpent: 375,  lastPurchase: '2026-07-08', favorite: 'Batata Completa'  },
  ],

  fornecedores: [
    { id: 1, name: 'Frigorífico São Jorge',  product: 'Bacon, Calabresa',           phone: '(11) 9 9999-0001', price: 'R$ 18/kg',    lastBuy: '2026-07-02', notes: 'Entrega ter/qui' },
    { id: 2, name: 'Distribuidora Cheddar+', product: 'Cheddar cremoso',            phone: '(11) 9 9999-0002', price: 'R$ 22/kg',    lastBuy: '2026-07-01', notes: 'Pedir 2 dias antes' },
    { id: 3, name: 'Supra Hortifrutti',      product: 'Batata, Aipim, Couve',       phone: '(11) 9 9999-0003', price: 'R$ 4/kg',     lastBuy: '2026-07-03', notes: 'Pedido na segunda' },
    { id: 4, name: 'Bebidas & Cia',          product: 'Refrigerantes, bebidas',     phone: '(11) 9 9999-0004', price: 'Tabela',      lastBuy: '2026-07-01', notes: 'Mín. 2 caixas' },
    { id: 5, name: 'Embalagem Pro',          product: 'Caixas, sacolas, adesivos',  phone: '(11) 9 9999-0005', price: 'A negociar',  lastBuy: '2026-06-28', notes: 'A cada 2 semanas' },
  ],

  campaigns: [],
};

/* ── State Management ─────────────────────────────────────────── */
const Storage = {
  getState() {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return structuredClone(seedData);

    try {
      const parsed = JSON.parse(raw);
      // Migrations: add missing top-level keys without losing data
      if (!parsed.fornecedores) parsed.fornecedores = structuredClone(seedData.fornecedores);
      if (!parsed.campaigns)    parsed.campaigns    = [];
      if (!parsed.settings)     parsed.settings     = structuredClone(seedData.settings);
      if (['Distrito XVII', 'Distrito OS'].includes(parsed.settings.restaurantName)) {
        parsed.settings.restaurantName = 'Petisbar Teodoro';
        localStorage.setItem(STORE_KEY, JSON.stringify(parsed));
      }
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

  /* ── Auth ───────────────────────────────────────────────────── */
  isAuthenticated() {
    return localStorage.getItem(AUTH_KEY) === 'ok';
  },

  login(username, password) {
    // TODO: replace with API call when backend is ready
    if (username === 'admin' && password === 'petisbarteodoro') {
      localStorage.setItem(AUTH_KEY, 'ok');
      return true;
    }
    return false;
  },

  logout() {
    localStorage.removeItem(AUTH_KEY);
  },
};
