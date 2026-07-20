/* ============================================================
   Petisbar Teodoro — Stores v0.3
   Armazenamento separado por domínio: Produtos, Ingredientes,
   Fichas Técnicas. Cada store é independente do storage.js
   legado (que persiste pedidos, finanças, clientes, etc.).
   ============================================================ */

const STORE_KEYS = {
  PRODUTOS:     'distrito-produtos-v2',
  INGREDIENTES: 'distrito-ingredientes-v2',
  FICHAS:       'distrito-fichas-v2',
};

/* ── Domínio: Categorias e Unidades ──────────────────────────── */

const CATEGORIAS_PRODUTO = [
  'Drinks', 'Cervejas', 'Refrigerantes', 'Águas', 'Energéticos', 'Açaí', 'Conveniência', 'Outros',
];

const CATEGORIAS_INGREDIENTE = [
  'Destilados', 'Frutas', 'Açúcares e Xaropes', 'Embalagens', 'Bebidas', 'Insumos', 'Outros',
];

const UNIDADES = ['g', 'kg', 'ml', 'L', 'un', 'cx', 'sc'];

/* ── Store Factory ───────────────────────────────────────────── */

function makeStore(key, seedValue) {
  return {
    get() {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : structuredClone(seedValue);
      } catch {
        return structuredClone(seedValue);
      }
    },
    set(value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
    clear() {
      localStorage.removeItem(key);
    },
  };
}

/* ── Conversão de Unidades ───────────────────────────────────── */

const _UNIT_MAP = {
  g:  { g: 1,     kg: 0.001 },
  kg: { g: 1000,  kg: 1     },
  ml: { ml: 1,    L: 0.001  },
  L:  { ml: 1000, L: 1      },
};

function convertUnits(from, to) {
  if (from === to) return 1;
  return _UNIT_MAP[from]?.[to] ?? null;
}

function compatibleUnits(u1, u2) {
  if (u1 === u2) return true;
  return convertUnits(u1, u2) !== null;
}

function calcIngredienteCost(ingrediente, qty, unit) {
  const { custoUnitario, unidade } = ingrediente;
  if (unit === unidade) return qty * custoUnitario;
  const factor = convertUnits(unit, unidade);
  if (factor === null) return null;
  return qty * factor * custoUnitario;
}

/* Calcula custo de um produto via ficha técnica ou custoCompra */
function calcCustoProduto(produtoId) {
  if (typeof Stores === 'undefined') return null;
  const fichas = Stores.fichas.get();
  const ficha  = fichas.find(f => f.produtoId === produtoId);
  if (!ficha) {
    const produto = Stores.produtos.get().find(p => p.id === produtoId);
    return produto?.custoCompra ?? null;
  }
  const ingredientes = Stores.ingredientes.get();
  const total = ficha.itens.reduce((sum, fi) => {
    const ing = ingredientes.find(i => i.id === fi.ingredienteId);
    if (!ing) return sum;
    const custo = calcIngredienteCost(ing, fi.quantidade, fi.unidade);
    return custo !== null ? sum + custo : sum;
  }, 0);
  return total / (ficha.rendimento || 1);
}

/* ── Seed Data: Ingredientes (15 insumos de bar) ─────────────── */

const SEED_INGREDIENTES = [
  /* Destilados — custoUnitario por ml (preco_garrafa / volume_ml) */
  { id: 'i-001', sku: 'INS001', nome: 'Cachaça 51',           categoria: 'Destilados',         unidade: 'ml', estoqueAtual: 1930, estoqueMinimo: 965,  custoUnitario: 15 / 965,  fornecedor: 'Bebidas & Cia',     ativo: true },
  { id: 'i-002', sku: 'INS002', nome: 'Vodka Smirnoff',       categoria: 'Destilados',         unidade: 'ml', estoqueAtual: 2000, estoqueMinimo: 1000, custoUnitario: 28 / 1000, fornecedor: 'Bebidas & Cia',     ativo: true },
  { id: 'i-004', sku: 'INS004', nome: 'Whisky Red Label',     categoria: 'Destilados',         unidade: 'ml', estoqueAtual: 1000, estoqueMinimo: 500,  custoUnitario: 75 / 1000, fornecedor: 'Bebidas & Cia',     ativo: true },
  /* Frutas frescas — custo por kg */
  { id: 'i-005', sku: 'INS005', nome: 'Morango Fresco',       categoria: 'Frutas',             unidade: 'kg', estoqueAtual: 2,    estoqueMinimo: 1,    custoUnitario: 12,         fornecedor: 'Supra Hortifrutti', ativo: true },
  { id: 'i-006', sku: 'INS006', nome: 'Limão Tahiti',         categoria: 'Frutas',             unidade: 'kg', estoqueAtual: 3,    estoqueMinimo: 1,    custoUnitario: 8,          fornecedor: 'Supra Hortifrutti', ativo: true },
  { id: 'i-007', sku: 'INS007', nome: 'Maracujá Polpa',       categoria: 'Frutas',             unidade: 'kg', estoqueAtual: 1.5,  estoqueMinimo: 0.5,  custoUnitario: 10,         fornecedor: 'Supra Hortifrutti', ativo: true },
  /* Açúcares e Insumos secos */
  { id: 'i-008', sku: 'INS008', nome: 'Açúcar Cristal',       categoria: 'Açúcares e Xaropes', unidade: 'kg', estoqueAtual: 5,    estoqueMinimo: 2,    custoUnitario: 4,          fornecedor: '',                  ativo: true },
  { id: 'i-009', sku: 'INS009', nome: 'Gelo em Cubo',         categoria: 'Insumos',            unidade: 'kg', estoqueAtual: 20,   estoqueMinimo: 5,    custoUnitario: 2,          fornecedor: '',                  ativo: true },
  /* Bebidas unitárias */
  { id: 'i-010', sku: 'INS010', nome: 'Energético 250ml',     categoria: 'Bebidas',            unidade: 'un', estoqueAtual: 24,   estoqueMinimo: 12,   custoUnitario: 4.50,       fornecedor: 'Bebidas & Cia',     ativo: true },
  { id: 'i-011', sku: 'INS011', nome: 'Copo Plástico 500ml',  categoria: 'Embalagens',         unidade: 'un', estoqueAtual: 200,  estoqueMinimo: 50,   consumoMedioDiario: 10, prazoReposicaoDias: 5, quantidadePacote: 100, custoUnitario: 0.30, fornecedor: 'Embalagem Pro', ativo: true },
  { id: 'i-012', sku: 'INS012', nome: 'Canudo Descartável',   categoria: 'Embalagens',         unidade: 'un', estoqueAtual: 500,  estoqueMinimo: 200,  custoUnitario: 0.10,       fornecedor: 'Embalagem Pro',     ativo: true },
  { id: 'i-013', sku: 'INS013', nome: 'Cerveja Brahma 350ml', categoria: 'Bebidas',            unidade: 'un', estoqueAtual: 48,   estoqueMinimo: 24,   custoUnitario: 3.00,       fornecedor: 'Bebidas & Cia',     ativo: true },
  { id: 'i-014', sku: 'INS014', nome: 'Coca-Cola 350ml',      categoria: 'Bebidas',            unidade: 'un', estoqueAtual: 36,   estoqueMinimo: 12,   custoUnitario: 2.80,       fornecedor: 'Bebidas & Cia',     ativo: true },
  { id: 'i-015', sku: 'INS015', nome: 'Água Mineral 500ml',   categoria: 'Bebidas',            unidade: 'un', estoqueAtual: 48,   estoqueMinimo: 24,   custoUnitario: 1.20,       fornecedor: 'Bebidas & Cia',     ativo: true },
];

/* ── Seed Data: Produtos (35 itens de bar) ───────────────────── */

const SEED_PRODUTOS = [
  /* ── Drinks (11) — custo calculado pela ficha técnica ──────── */
  { id: 'p-drk001', sku: 'DRK001', nome: 'Caipirinha Limão 500ml',           categoria: 'Drinks',        descricao: 'Copo 500ml com cachaça 51, limão tahiti, açúcar e gelo',                precoVenda: 15.90, custoCompra: null, ativo: true, tempoPreparo: 5, estoqueAtual: null, estoqueMinimo: null, dataCadastro: '2026-07-01' },
  { id: 'p-drk002', sku: 'DRK002', nome: 'Caipirinha Morango 500ml',         categoria: 'Drinks',        descricao: 'Copo 500ml com cachaça 51, morango fresco, açúcar e gelo',              precoVenda: 16.90, custoCompra: null, ativo: true, tempoPreparo: 5, estoqueAtual: null, estoqueMinimo: null, dataCadastro: '2026-07-01' },
  { id: 'p-drk003', sku: 'DRK003', nome: 'Caipirinha Maracujá 500ml',        categoria: 'Drinks',        descricao: 'Copo 500ml com cachaça 51, polpa de maracujá, açúcar e gelo',           precoVenda: 17.90, custoCompra: null, ativo: true, tempoPreparo: 5, estoqueAtual: null, estoqueMinimo: null, dataCadastro: '2026-07-01' },
  { id: 'p-drk004', sku: 'DRK004', nome: 'Caipivodka Limão 500ml',           categoria: 'Drinks',        descricao: 'Copo 500ml com vodka Smirnoff, limão tahiti, açúcar e gelo',            precoVenda: 19.90, custoCompra: null, ativo: true, tempoPreparo: 5, estoqueAtual: null, estoqueMinimo: null, dataCadastro: '2026-07-01' },
  { id: 'p-drk005', sku: 'DRK005', nome: 'Caipivodka Morango 500ml',         categoria: 'Drinks',        descricao: 'Copo 500ml com vodka Smirnoff, morango fresco, açúcar e gelo',          precoVenda: 20.90, custoCompra: null, ativo: true, tempoPreparo: 5, estoqueAtual: null, estoqueMinimo: null, dataCadastro: '2026-07-01' },
  { id: 'p-drk006', sku: 'DRK006', nome: 'Caipivodka Maracujá 500ml',        categoria: 'Drinks',        descricao: 'Copo 500ml com vodka Smirnoff, polpa de maracujá, açúcar e gelo',       precoVenda: 21.90, custoCompra: null, ativo: true, tempoPreparo: 5, estoqueAtual: null, estoqueMinimo: null, dataCadastro: '2026-07-01' },
  { id: 'p-drk010', sku: 'DRK010', nome: 'Vodka + Energético 500ml',         categoria: 'Drinks',        descricao: 'Copo 500ml com vodka Smirnoff, energético 250ml e gelo',                precoVenda: 19.90, custoCompra: null, ativo: true, tempoPreparo: 3, estoqueAtual: null, estoqueMinimo: null, dataCadastro: '2026-07-01' },
  { id: 'p-drk011', sku: 'DRK011', nome: 'Whisky + Energético 500ml',        categoria: 'Drinks',        descricao: 'Copo 500ml com whisky Red Label, energético 250ml e gelo',              precoVenda: 24.90, custoCompra: null, ativo: true, tempoPreparo: 3, estoqueAtual: null, estoqueMinimo: null, dataCadastro: '2026-07-01' },
  /* ── Cervejas (6) — estoque físico, custo de compra ────────── */
  { id: 'p-bee001', sku: 'BEE001', nome: 'Brahma Lata 350ml',          categoria: 'Cervejas',      descricao: 'Cerveja Brahma lata 350ml',                              precoVenda: 6.00,  custoCompra: 3.00, ativo: true, tempoPreparo: 1, estoqueAtual: 48, estoqueMinimo: 24, dataCadastro: '2026-07-01' },
  { id: 'p-bee002', sku: 'BEE002', nome: 'Skol Lata 350ml',            categoria: 'Cervejas',      descricao: 'Cerveja Skol lata 350ml',                                precoVenda: 6.00,  custoCompra: 2.80, ativo: true, tempoPreparo: 1, estoqueAtual: 48, estoqueMinimo: 24, dataCadastro: '2026-07-01' },
  { id: 'p-bee003', sku: 'BEE003', nome: 'Corona 355ml',               categoria: 'Cervejas',      descricao: 'Cerveja Corona garrafa 355ml',                           precoVenda: 12.00, custoCompra: 5.50, ativo: true, tempoPreparo: 1, estoqueAtual: 24, estoqueMinimo: 12, dataCadastro: '2026-07-01' },
  { id: 'p-bee004', sku: 'BEE004', nome: 'Heineken 330ml',             categoria: 'Cervejas',      descricao: 'Cerveja Heineken lata 330ml',                            precoVenda: 10.00, custoCompra: 4.50, ativo: true, tempoPreparo: 1, estoqueAtual: 36, estoqueMinimo: 12, dataCadastro: '2026-07-01' },
  { id: 'p-bee005', sku: 'BEE005', nome: 'Budweiser 350ml',            categoria: 'Cervejas',      descricao: 'Cerveja Budweiser lata 350ml',                           precoVenda: 8.00,  custoCompra: 3.50, ativo: true, tempoPreparo: 1, estoqueAtual: 36, estoqueMinimo: 12, dataCadastro: '2026-07-01' },
  { id: 'p-bee006', sku: 'BEE006', nome: 'Artesanal 600ml',            categoria: 'Cervejas',      descricao: 'Cerveja artesanal local garrafa 600ml',                  precoVenda: 18.00, custoCompra: 9.00, ativo: true, tempoPreparo: 1, estoqueAtual: 12, estoqueMinimo: 6,  dataCadastro: '2026-07-01' },
  /* ── Refrigerantes (4) ─────────────────────────────────────── */
  { id: 'p-ref001', sku: 'REF001', nome: 'Coca-Cola 350ml',            categoria: 'Refrigerantes', descricao: 'Coca-Cola lata 350ml',                                   precoVenda: 6.00,  custoCompra: 2.80, ativo: true, tempoPreparo: 1, estoqueAtual: 36, estoqueMinimo: 12, dataCadastro: '2026-07-01' },
  { id: 'p-ref002', sku: 'REF002', nome: 'Guaraná Antarctica 350ml',   categoria: 'Refrigerantes', descricao: 'Guaraná Antarctica lata 350ml',                          precoVenda: 5.00,  custoCompra: 2.50, ativo: true, tempoPreparo: 1, estoqueAtual: 24, estoqueMinimo: 12, dataCadastro: '2026-07-01' },
  { id: 'p-ref003', sku: 'REF003', nome: 'Sprite 350ml',               categoria: 'Refrigerantes', descricao: 'Sprite lata 350ml',                                     precoVenda: 5.00,  custoCompra: 2.50, ativo: true, tempoPreparo: 1, estoqueAtual: 24, estoqueMinimo: 12, dataCadastro: '2026-07-01' },
  { id: 'p-ref004', sku: 'REF004', nome: 'Schweppes Tônica 350ml',     categoria: 'Refrigerantes', descricao: 'Schweppes água tônica lata 350ml',                      precoVenda: 5.50,  custoCompra: 2.80, ativo: true, tempoPreparo: 1, estoqueAtual: 24, estoqueMinimo: 12, dataCadastro: '2026-07-01' },
  /* ── Águas (2) ─────────────────────────────────────────────── */
  { id: 'p-agu001', sku: 'AGU001', nome: 'Água Mineral 500ml',         categoria: 'Águas',         descricao: 'Água mineral sem gás 500ml',                             precoVenda: 3.00,  custoCompra: 1.20, ativo: true, tempoPreparo: 1, estoqueAtual: 48, estoqueMinimo: 24, dataCadastro: '2026-07-01' },
  { id: 'p-agu002', sku: 'AGU002', nome: 'Água com Gás 500ml',         categoria: 'Águas',         descricao: 'Água mineral com gás 500ml',                             precoVenda: 4.00,  custoCompra: 1.80, ativo: true, tempoPreparo: 1, estoqueAtual: 24, estoqueMinimo: 12, dataCadastro: '2026-07-01' },
  /* ── Energéticos (2) ───────────────────────────────────────── */
  { id: 'p-ene001', sku: 'ENE001', nome: 'Red Bull 250ml',             categoria: 'Energéticos',   descricao: 'Red Bull lata 250ml',                                    precoVenda: 12.00, custoCompra: 5.50, ativo: true, tempoPreparo: 1, estoqueAtual: 24, estoqueMinimo: 12, dataCadastro: '2026-07-01' },
  { id: 'p-ene002', sku: 'ENE002', nome: 'Monster Energy 473ml',       categoria: 'Energéticos',   descricao: 'Monster Energy lata 473ml',                              precoVenda: 12.00, custoCompra: 6.00, ativo: true, tempoPreparo: 1, estoqueAtual: 24, estoqueMinimo: 12, dataCadastro: '2026-07-01' },
  /* ── Açaí (5) ──────────────────────────────────────────────── */
  { id: 'p-aca001', sku: 'ACA001', nome: 'Batidinha de Açaí 300ml',    categoria: 'Açaí',          descricao: 'Açaí batido e servido em garrafinha de 300ml',           precoVenda: 15.00, custoCompra: 8.00,  ativo: true,  tempoPreparo: 5, estoqueAtual: 20, estoqueMinimo: 5, dataCadastro: '2026-07-01' },
  { id: 'p-aca002', sku: 'ACA002', nome: 'Açaí 500ml',                 categoria: 'Açaí',          descricao: 'Tamanho antigo — item desativado',                       precoVenda: 32.00, custoCompra: 12.00, ativo: false, tempoPreparo: 5, estoqueAtual: 20, estoqueMinimo: 5, dataCadastro: '2026-07-01' },
  { id: 'p-aca003', sku: 'ACA003', nome: 'Açaí 700ml',                 categoria: 'Açaí',          descricao: 'Tamanho antigo — item desativado',                       precoVenda: 42.00, custoCompra: 16.00, ativo: false, tempoPreparo: 5, estoqueAtual: 10, estoqueMinimo: 3, dataCadastro: '2026-07-01' },
  { id: 'p-aca004', sku: 'ACA004', nome: 'Açaí 1L',                    categoria: 'Açaí',          descricao: 'Tamanho antigo — item desativado',                       precoVenda: 55.00, custoCompra: 22.00, ativo: false, tempoPreparo: 5, estoqueAtual: 8,  estoqueMinimo: 2, dataCadastro: '2026-07-01' },
  { id: 'p-aca005', sku: 'ACA005', nome: 'Açaí c/ Complementos 500ml', categoria: 'Açaí',          descricao: 'Tamanho antigo — item desativado',                       precoVenda: 38.00, custoCompra: 15.00, ativo: false, tempoPreparo: 7, estoqueAtual: 10, estoqueMinimo: 3, dataCadastro: '2026-07-01' },
  /* ── Conveniência (5) ──────────────────────────────────────── */
  { id: 'p-con001', sku: 'CON001', nome: 'Amendoim Temperado 100g',    categoria: 'Conveniência',  descricao: 'Amendoim crocante temperado 100g',                       precoVenda: 8.00,  custoCompra: 3.00, ativo: true, tempoPreparo: 1, estoqueAtual: 30, estoqueMinimo: 10, dataCadastro: '2026-07-01' },
  { id: 'p-con002', sku: 'CON002', nome: 'Mix de Nuts 100g',           categoria: 'Conveniência',  descricao: 'Mix de castanhas e nozes premium 100g',                  precoVenda: 12.00, custoCompra: 5.00, ativo: true, tempoPreparo: 1, estoqueAtual: 20, estoqueMinimo: 8,  dataCadastro: '2026-07-01' },
  { id: 'p-con003', sku: 'CON003', nome: 'Batata Chips 60g',           categoria: 'Conveniência',  descricao: 'Batata chips crocante sabor original 60g',               precoVenda: 8.00,  custoCompra: 3.50, ativo: true, tempoPreparo: 1, estoqueAtual: 30, estoqueMinimo: 10, dataCadastro: '2026-07-01' },
  { id: 'p-con004', sku: 'CON004', nome: 'Azeitona Temperada 100g',    categoria: 'Conveniência',  descricao: 'Azeitona verde temperada com ervas 100g',                precoVenda: 10.00, custoCompra: 4.00, ativo: true, tempoPreparo: 1, estoqueAtual: 20, estoqueMinimo: 8,  dataCadastro: '2026-07-01' },
  { id: 'p-con005', sku: 'CON005', nome: 'Torresmo 150g',              categoria: 'Conveniência',  descricao: 'Torresmo artesanal crocante 150g',                       precoVenda: 15.00, custoCompra: 5.50, ativo: true, tempoPreparo: 3, estoqueAtual: 20, estoqueMinimo: 8,  dataCadastro: '2026-07-01' },
];

// A operação começa sem compras realizadas.
SEED_INGREDIENTES.forEach(ingrediente => {
  ingrediente.estoqueAtual = 0;
  ingrediente.consumoMedioDiario ??= 0;
  ingrediente.prazoReposicaoDias ??= 0;
  ingrediente.quantidadePacote ??= 1;
});

const PRODUCT_PHOTOS_BY_CATEGORY = {
  Drinks: '../assets/products/caipirinha.jpg',
  Cervejas: '../assets/products/beer.jpg',
  Refrigerantes: '../assets/products/soda.jpg',
  'Águas': '../assets/products/water.jpg',
  'Energéticos': '../assets/products/energy-drink.jpg',
  'Açaí': '../assets/products/acai.jpg',
  'Conveniência': '../assets/products/snacks.jpg',
};

function getDefaultProductPhoto(product) {
  if (['p-drk010', 'p-drk011'].includes(product.id)) {
    return '../assets/products/energy-cocktail.jpg';
  }
  return PRODUCT_PHOTOS_BY_CATEGORY[product.categoria] || null;
}

SEED_PRODUTOS.forEach(product => {
  product.foto = getDefaultProductPhoto(product);
  if (product.estoqueAtual !== null && product.estoqueAtual !== undefined) {
    product.estoqueAtual = 0;
  }
});

/* ── Seed Data: Fichas Técnicas (11 drinks) ──────────────────── */
/*
  CMV de referência (calculado pelos custos dos insumos):
    DRK001 Caipirinha Limão      R$3.33 / R$15.90 = 21.0%
    DRK002 Caipirinha Morango    R$3.49 / R$16.90 = 20.7%
    DRK003 Caipirinha Maracujá   R$3.13 / R$17.90 = 17.5%
    DRK004 Caipivodka Limão      R$4.58 / R$19.90 = 23.0%
    DRK005 Caipivodka Morango    R$4.74 / R$20.90 = 22.7%
    DRK006 Caipivodka Maracujá   R$4.38 / R$21.90 = 20.0%
    DRK010 Vodka + Energético    R$6.70 / R$19.90 = 33.7%
    DRK011 Whisky + Energético   R$9.05 / R$24.90 = 36.3%
*/
const SEED_FICHAS = [
  {
    id: 'f-drk001', produtoId: 'p-drk001', rendimento: 1,
    itens: [
      { ingredienteId: 'i-001', quantidade: 100, unidade: 'ml' },
      { ingredienteId: 'i-006', quantidade: 100, unidade: 'g'  },
      { ingredienteId: 'i-008', quantidade: 20,  unidade: 'g'  },
      { ingredienteId: 'i-009', quantidade: 250, unidade: 'g'  },
      { ingredienteId: 'i-011', quantidade: 1,   unidade: 'un' },
      { ingredienteId: 'i-012', quantidade: 1,   unidade: 'un' },
    ],
  },
  {
    id: 'f-drk002', produtoId: 'p-drk002', rendimento: 1,
    itens: [
      { ingredienteId: 'i-001', quantidade: 100, unidade: 'ml' },
      { ingredienteId: 'i-005', quantidade: 80,  unidade: 'g'  },
      { ingredienteId: 'i-008', quantidade: 20,  unidade: 'g'  },
      { ingredienteId: 'i-009', quantidade: 250, unidade: 'g'  },
      { ingredienteId: 'i-011', quantidade: 1,   unidade: 'un' },
      { ingredienteId: 'i-012', quantidade: 1,   unidade: 'un' },
    ],
  },
  {
    id: 'f-drk003', produtoId: 'p-drk003', rendimento: 1,
    itens: [
      { ingredienteId: 'i-001', quantidade: 100, unidade: 'ml' },
      { ingredienteId: 'i-007', quantidade: 60,  unidade: 'g'  },
      { ingredienteId: 'i-008', quantidade: 20,  unidade: 'g'  },
      { ingredienteId: 'i-009', quantidade: 250, unidade: 'g'  },
      { ingredienteId: 'i-011', quantidade: 1,   unidade: 'un' },
      { ingredienteId: 'i-012', quantidade: 1,   unidade: 'un' },
    ],
  },
  {
    id: 'f-drk004', produtoId: 'p-drk004', rendimento: 1,
    itens: [
      { ingredienteId: 'i-002', quantidade: 100, unidade: 'ml' },
      { ingredienteId: 'i-006', quantidade: 100, unidade: 'g'  },
      { ingredienteId: 'i-008', quantidade: 20,  unidade: 'g'  },
      { ingredienteId: 'i-009', quantidade: 250, unidade: 'g'  },
      { ingredienteId: 'i-011', quantidade: 1,   unidade: 'un' },
      { ingredienteId: 'i-012', quantidade: 1,   unidade: 'un' },
    ],
  },
  {
    id: 'f-drk005', produtoId: 'p-drk005', rendimento: 1,
    itens: [
      { ingredienteId: 'i-002', quantidade: 100, unidade: 'ml' },
      { ingredienteId: 'i-005', quantidade: 80,  unidade: 'g'  },
      { ingredienteId: 'i-008', quantidade: 20,  unidade: 'g'  },
      { ingredienteId: 'i-009', quantidade: 250, unidade: 'g'  },
      { ingredienteId: 'i-011', quantidade: 1,   unidade: 'un' },
      { ingredienteId: 'i-012', quantidade: 1,   unidade: 'un' },
    ],
  },
  {
    id: 'f-drk006', produtoId: 'p-drk006', rendimento: 1,
    itens: [
      { ingredienteId: 'i-002', quantidade: 100, unidade: 'ml' },
      { ingredienteId: 'i-007', quantidade: 60,  unidade: 'g'  },
      { ingredienteId: 'i-008', quantidade: 20,  unidade: 'g'  },
      { ingredienteId: 'i-009', quantidade: 250, unidade: 'g'  },
      { ingredienteId: 'i-011', quantidade: 1,   unidade: 'un' },
      { ingredienteId: 'i-012', quantidade: 1,   unidade: 'un' },
    ],
  },
  {
    id: 'f-drk010', produtoId: 'p-drk010', rendimento: 1,
    itens: [
      { ingredienteId: 'i-002', quantidade: 50,  unidade: 'ml' },
      { ingredienteId: 'i-010', quantidade: 1,   unidade: 'un' },
      { ingredienteId: 'i-009', quantidade: 200, unidade: 'g'  },
      { ingredienteId: 'i-011', quantidade: 1,   unidade: 'un' },
      { ingredienteId: 'i-012', quantidade: 1,   unidade: 'un' },
    ],
  },
  {
    id: 'f-drk011', produtoId: 'p-drk011', rendimento: 1,
    itens: [
      { ingredienteId: 'i-004', quantidade: 50,  unidade: 'ml' },
      { ingredienteId: 'i-010', quantidade: 1,   unidade: 'un' },
      { ingredienteId: 'i-009', quantidade: 200, unidade: 'g'  },
      { ingredienteId: 'i-011', quantidade: 1,   unidade: 'un' },
      { ingredienteId: 'i-012', quantidade: 1,   unidade: 'un' },
    ],
  },
];

/* ── Domínio: Pedidos e Clientes ─────────────────────────────── */

const ORIGENS = ['WhatsApp', 'iFood', 'Site', 'Instagram', 'Balcão', 'Telefone'];

const STATUS_PEDIDO = [
  'Novo', 'Aguardando Pagamento', 'Pago',
  'Em Produção', 'Pronto', 'Saiu para Entrega',
  'Entregue', 'Cancelado',
];

const FORMAS_PAGAMENTO = [
  'Dinheiro', 'Cartão Débito', 'Cartão Crédito', 'PIX', 'iFood', 'Fiado',
];

const STATUS_TRANSITIONS = {
  'Novo':                ['Aguardando Pagamento', 'Em Produção', 'Cancelado'],
  'Aguardando Pagamento':['Pago', 'Cancelado'],
  'Pago':                ['Em Produção', 'Cancelado'],
  'Em Produção':         ['Pronto', 'Cancelado'],
  'Pronto':              ['Saiu para Entrega', 'Entregue', 'Cancelado'],
  'Saiu para Entrega':   ['Entregue', 'Cancelado'],
  'Entregue':            [],
  'Cancelado':           [],
};

/* Retorna o próximo status do fluxo principal (happy path) */
function nextStatus(status) {
  const map = {
    'Novo':                'Aguardando Pagamento',
    'Aguardando Pagamento':'Pago',
    'Pago':                'Em Produção',
    'Em Produção':         'Pronto',
    'Pronto':              'Saiu para Entrega',
    'Saiu para Entrega':   'Entregue',
  };
  return map[status] || null;
}

/* Retorna o próximo número de pedido (max + 1) */
function nextNumeroPedido(pedidos) {
  if (!pedidos || !pedidos.length) return 1;
  const max = Math.max(0, ...pedidos.map(p => Number(p.numeroPedido) || 0));
  return max + 1;
}

/* ── Seed Data: Pedidos ──────────────────────────────────────── */

const SEED_PEDIDOS = [
  {
    id: 'ped-001', numeroPedido: 1,
    origem: 'Balcão', clienteId: null, clienteNome: 'Balcão',
    status: 'Entregue',
    itens: [
      { produtoId: 'p-drk001', nome: 'Caipirinha Limão',  qty: 2, precoUnitario: 15.90, subtotal: 31.80 },
      { produtoId: 'p-bee001', nome: 'Brahma Lata 350ml', qty: 2, precoUnitario: 6.00,  subtotal: 12.00 },
    ],
    subtotal: 43.80, taxaEntrega: 0, desconto: 0, total: 43.80,
    formaPagamento: 'PIX', observacoes: '',
    dataCriacao: '2026-07-10T20:00:00.000Z', dataAtualizacao: '2026-07-10T20:30:00.000Z',
  },
  {
    id: 'ped-002', numeroPedido: 2,
    origem: 'WhatsApp', clienteId: 'cli-001', clienteNome: 'Ana Lima',
    status: 'Entregue',
    itens: [
      { produtoId: 'p-drk004', nome: 'Caipivodka Limão',         qty: 1, precoUnitario: 19.90, subtotal: 19.90 },
      { produtoId: 'p-drk005', nome: 'Caipivodka Morango',        qty: 1, precoUnitario: 20.90, subtotal: 20.90 },
      { produtoId: 'p-con001', nome: 'Amendoim Temperado 100g',   qty: 1, precoUnitario: 8.00,  subtotal: 8.00  },
    ],
    subtotal: 48.80, taxaEntrega: 8, desconto: 0, total: 56.80,
    formaPagamento: 'PIX', observacoes: '',
    dataCriacao: '2026-07-12T19:30:00.000Z', dataAtualizacao: '2026-07-12T20:15:00.000Z',
  },
  {
    id: 'ped-003', numeroPedido: 3,
    origem: 'Balcão', clienteId: null, clienteNome: 'Balcão',
    status: 'Em Produção',
    itens: [
      { produtoId: 'p-drk002', nome: 'Caipirinha Morango', qty: 2, precoUnitario: 16.90, subtotal: 33.80 },
      { produtoId: 'p-ref001', nome: 'Coca-Cola 350ml',    qty: 1, precoUnitario: 6.00,  subtotal: 6.00  },
    ],
    subtotal: 39.80, taxaEntrega: 0, desconto: 0, total: 39.80,
    formaPagamento: 'Dinheiro', observacoes: 'Sem açúcar em uma das caipirinhas',
    dataCriacao: '2026-07-15T20:00:00.000Z', dataAtualizacao: '2026-07-15T20:05:00.000Z',
  },
  {
    id: 'ped-004', numeroPedido: 4,
    origem: 'Instagram', clienteId: 'cli-002', clienteNome: 'Carlos Matos',
    status: 'Novo',
    itens: [
      { produtoId: 'p-drk011', nome: 'Whisky + Energético', qty: 1, precoUnitario: 24.90, subtotal: 24.90 },
      { produtoId: 'p-aca002', nome: 'Açaí 500ml',          qty: 1, precoUnitario: 32.00, subtotal: 32.00 },
    ],
    subtotal: 56.90, taxaEntrega: 8, desconto: 0, total: 64.90,
    formaPagamento: 'PIX', observacoes: '',
    dataCriacao: '2026-07-15T20:30:00.000Z', dataAtualizacao: '2026-07-15T20:30:00.000Z',
  },
];

/* ── Seed Data: Clientes ─────────────────────────────────────── */

const SEED_CLIENTES = [
  {
    id: 'cli-001', nome: 'Ana Lima',
    telefone: '(11) 99999-0001', email: 'ana.lima@email.com', cpf: '',
    observacoes: 'Prefere caipivodka',
    enderecos: [
      { id: 'end-001', rua: 'Rua das Flores', numero: '123', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP', cep: '01000-000', complemento: 'Apto 5' },
    ],
    dataCadastro: '2026-07-01',
  },
  {
    id: 'cli-002', nome: 'Carlos Matos',
    telefone: '(11) 98888-0002', email: '', cpf: '',
    observacoes: '',
    enderecos: [
      { id: 'end-002', rua: 'Av. Paulista', numero: '1500', bairro: 'Bela Vista', cidade: 'São Paulo', estado: 'SP', cep: '01310-200', complemento: '' },
    ],
    dataCadastro: '2026-07-05',
  },
  {
    id: 'cli-003', nome: 'Fernanda Costa',
    telefone: '(11) 97777-0003', email: 'fernanda@email.com', cpf: '',
    observacoes: '',
    enderecos: [],
    dataCadastro: '2026-07-08',
  },
];

/* ── Store Keys v3 ───────────────────────────────────────────── */

const STORE_KEYS_V3 = {
  PEDIDOS:  'distrito-pedidos-v1',
  CLIENTES: 'distrito-clientes-v1',
};

/* ── Store Keys v4 (Sprint 4) ────────────────────────────────── */

const STORE_KEYS_V4 = {
  FORNECEDORES:  'distrito-fornecedores-v1',
  COMPRAS:       'distrito-compras-v1',
  MOVIMENTACOES: 'distrito-movimentacoes-v1',
  CUPONS:        'distrito-cupons-v1',
  DOCUMENTOS:    'distrito-documentos-v1',
  CONFIG:        'distrito-config-v1',
};

/* ── Seed Data: Fornecedores ─────────────────────────────────── */

const SEED_FORNECEDORES = [
  { id: 'for-001', nome: 'Supra Hortifrutti',   cnpj: '', telefone: '(11) 9 9999-0003', email: '', contato: '', categoria: 'Hortifruti', prazoEntrega: 1, condicoesPagamento: 'À vista', observacoes: 'Pedido na segunda',  ativo: true, dataCadastro: '2026-07-01' },
  { id: 'for-002', nome: 'Bebidas & Cia',        cnpj: '', telefone: '(11) 9 9999-0004', email: '', contato: '', categoria: 'Bebidas',    prazoEntrega: 2, condicoesPagamento: 'À vista', observacoes: 'Mín. 2 caixas',     ativo: true, dataCadastro: '2026-07-01' },
  { id: 'for-003', nome: 'Embalagem Pro',        cnpj: '', telefone: '(11) 9 9999-0005', email: '', contato: '', categoria: 'Embalagens', prazoEntrega: 5, condicoesPagamento: 'À vista', observacoes: 'A cada 2 semanas', ativo: true, dataCadastro: '2026-07-01' },
];

const CATS_FORNECEDOR = ['Hortifruti', 'Carnes', 'Laticínios', 'Bebidas', 'Embalagens', 'Grãos', 'Temperos', 'Outros'];

/* ── Seed Data: Compras ──────────────────────────────────────── */

const STATUS_COMPRA = ['Rascunho', 'Aprovado', 'Pedido', 'Recebido', 'Cancelado'];

const SEED_COMPRAS = [
  {
    id: 'cmp-001', numeroPedidoCompra: 1,
    fornecedorId: 'for-001', fornecedorNome: 'Supra Hortifrutti',
    status: 'Recebido', tipo: 'manual',
    itens: [
      { ingredienteId: 'i-005', nome: 'Morango Fresco', quantidade: 3, unidade: 'kg', custoUnitario: 12, subtotal: 36 },
      { ingredienteId: 'i-006', nome: 'Limão Tahiti',   quantidade: 4, unidade: 'kg', custoUnitario: 8,  subtotal: 32 },
      { ingredienteId: 'i-007', nome: 'Maracujá Polpa', quantidade: 2, unidade: 'kg', custoUnitario: 10, subtotal: 20 },
    ],
    total: 88, observacoes: '',
    dataCompra: '2026-07-10', dataRecebimento: '2026-07-10',
    notaFiscal: '', formaPagamento: 'À vista',
  },
  {
    id: 'cmp-002', numeroPedidoCompra: 2,
    fornecedorId: 'for-002', fornecedorNome: 'Bebidas & Cia',
    status: 'Recebido', tipo: 'manual',
    itens: [
      { ingredienteId: 'i-001', nome: 'Cachaça 51',       quantidade: 4,  unidade: 'un', custoUnitario: 15,   subtotal: 60  },
      { ingredienteId: 'i-002', nome: 'Vodka Smirnoff',   quantidade: 2,  unidade: 'un', custoUnitario: 28,   subtotal: 56  },
      { ingredienteId: 'i-010', nome: 'Energético 250ml', quantidade: 24, unidade: 'un', custoUnitario: 4.50, subtotal: 108 },
    ],
    total: 224, observacoes: '',
    dataCompra: '2026-07-08', dataRecebimento: '2026-07-08',
    notaFiscal: '', formaPagamento: 'À vista',
  },
];

/* ── Seed Data: Movimentações de Estoque ─────────────────────── */

const TIPOS_MOVIMENTACAO = ['entrada', 'saída', 'ajuste', 'perda'];

const SEED_MOVIMENTACOES = [
  { id: 'mov-001', tipo: 'entrada', ingredienteId: 'i-005', ingredienteNome: 'Morango Fresco', quantidade: 3, unidade: 'kg', motivo: 'compra', referencia: 'cmp-001', data: '2026-07-10', usuario: 'admin' },
  { id: 'mov-002', tipo: 'entrada', ingredienteId: 'i-006', ingredienteNome: 'Limão Tahiti',   quantidade: 4, unidade: 'kg', motivo: 'compra', referencia: 'cmp-001', data: '2026-07-10', usuario: 'admin' },
  { id: 'mov-003', tipo: 'entrada', ingredienteId: 'i-001', ingredienteNome: 'Cachaça 51',     quantidade: 4, unidade: 'un', motivo: 'compra', referencia: 'cmp-002', data: '2026-07-08', usuario: 'admin' },
  { id: 'mov-004', tipo: 'entrada', ingredienteId: 'i-002', ingredienteNome: 'Vodka Smirnoff', quantidade: 2, unidade: 'un', motivo: 'compra', referencia: 'cmp-002', data: '2026-07-08', usuario: 'admin' },
];

/* ── Seed Data: Cupons ───────────────────────────────────────── */

const SEED_CUPONS = [
  { id: 'cup-001', codigo: 'BEMVINDO10',  tipo: 'percentual', valor: 10, ativo: true, usos: 3,  limite: 100, validade: '2026-12-31', descricao: 'Desconto de boas-vindas para novos clientes' },
  { id: 'cup-002', codigo: 'FIDELIDADE5', tipo: 'fixo',        valor: 5,  ativo: true, usos: 12, limite: 50,  validade: '2026-09-30', descricao: 'Desconto fidelidade R$ 5' },
];

/* ── Seed Data: Documentos ───────────────────────────────────── */

const CATS_DOCUMENTO = ['Alvará', 'Contrato', 'Fiscal', 'Manual', 'Receita', 'Outros'];

const SEED_DOCUMENTOS = [
  { id: 'doc-001', titulo: 'Alvará de Funcionamento 2026',           categoria: 'Alvará', data: '2026-01-15', link: '', notas: 'Válido até 31/12/2026', dataCadastro: '2026-07-01' },
  { id: 'doc-002', titulo: 'AVCB — Corpo de Bombeiros',              categoria: 'Alvará', data: '2025-08-20', link: '', notas: 'Renovar em ago/2026',  dataCadastro: '2026-07-01' },
  { id: 'doc-003', titulo: 'Manual de Boas Práticas de Manipulação', categoria: 'Manual', data: '2026-01-01', link: '', notas: '',                     dataCadastro: '2026-07-01' },
];

/* ── Seed Data: Configurações ────────────────────────────────── */

const SEED_CONFIG = {
  restaurante: { nome: 'Petisbar Teodoro', cnpj: '', telefone: '', email: '', endereco: '', cidade: 'São Paulo', estado: 'SP', cep: '' },
  metas: { cmvMeta: 35, margemMeta: 60, ticketMedioMeta: 60, clientesInativosDias: 30 },
  taxas: { taxaEntregaPadrao: 5, taxaIfood: 15, comissaoEntregador: 0 },
  horario: {
    segunda: 'Fechado', terca: '18:00 – 23:00', quarta: '18:00 – 23:00',
    quinta: '18:00 – 23:00', sexta: '18:00 – 00:00',
    sabado: '12:00 – 00:00', domingo: '12:00 – 22:00',
  },
  integracoes: { whatsapp: false, pix: false, impressora: false, ifood: false, ocr: false },
  frete: { padrao: 8, zonas: [] },
};

/* ── Stores ──────────────────────────────────────────────────── */

const Stores = {
  produtos:      makeStore(STORE_KEYS.PRODUTOS,          SEED_PRODUTOS),
  ingredientes:  makeStore(STORE_KEYS.INGREDIENTES,      SEED_INGREDIENTES),
  fichas:        makeStore(STORE_KEYS.FICHAS,            SEED_FICHAS),
  pedidos:       makeStore(STORE_KEYS_V3.PEDIDOS,        []),
  clientes:      makeStore(STORE_KEYS_V3.CLIENTES,       []),
  fornecedores:  makeStore(STORE_KEYS_V4.FORNECEDORES,   []),
  compras:       makeStore(STORE_KEYS_V4.COMPRAS,        []),
  movimentacoes: makeStore(STORE_KEYS_V4.MOVIMENTACOES,  []),
  cupons:        makeStore(STORE_KEYS_V4.CUPONS,         []),
  documentos:    makeStore(STORE_KEYS_V4.DOCUMENTOS,     []),
  config:        makeStore(STORE_KEYS_V4.CONFIG,         SEED_CONFIG),
};

// Atualiza apenas o nome padrão antigo, preservando configurações personalizadas.
// Limpeza única dos dados de demonstração já gravados em navegadores existentes.
const CLEAN_START_KEY = 'petisbar-clean-start-v1';
if (!localStorage.getItem(CLEAN_START_KEY)) {
  Stores.produtos.set(structuredClone(SEED_PRODUTOS));
  Stores.ingredientes.set(structuredClone(SEED_INGREDIENTES));
  Stores.fichas.set(structuredClone(SEED_FICHAS));
  Stores.pedidos.set([]);
  Stores.clientes.set([]);
  Stores.fornecedores.set([]);
  Stores.compras.set([]);
  Stores.movimentacoes.set([]);
  Stores.cupons.set([]);
  Stores.documentos.set([]);
  if (typeof Storage !== 'undefined') Storage.setState(structuredClone(seedData));
  localStorage.setItem(CLEAN_START_KEY, 'concluido');
}

// Remove o saquê e adiciona parâmetros de compra antecipada aos dados existentes.
const STOCK_PLANNING_MIGRATION_KEY = 'petisbar-stock-planning-v1';
if (!localStorage.getItem(STOCK_PLANNING_MIGRATION_KEY)) {
  const removedProductIds = new Set(['p-drk007', 'p-drk008', 'p-drk009']);
  Stores.produtos.set(Stores.produtos.get().filter(p => !removedProductIds.has(p.id)));
  Stores.fichas.set(Stores.fichas.get().filter(f => !removedProductIds.has(f.produtoId)));
  const ingredientesAtualizados = Stores.ingredientes.get()
    .filter(i => i.id !== 'i-003')
    .map(i => ({
      ...i,
      consumoMedioDiario: i.id === 'i-011' ? 10 : (i.consumoMedioDiario || 0),
      prazoReposicaoDias: i.id === 'i-011' ? 5 : (i.prazoReposicaoDias || 0),
      quantidadePacote: i.id === 'i-011' ? 100 : (i.quantidadePacote || 1),
      estoqueMinimo: i.id === 'i-011' ? 50 : i.estoqueMinimo,
    }));
  Stores.ingredientes.set(ingredientesAtualizados);
  localStorage.setItem(STOCK_PLANNING_MIGRATION_KEY, 'concluido');
}

const storedConfig = Stores.config.get();
if (['Distrito XVII', 'Distrito OS'].includes(storedConfig.restaurante?.nome)) {
  storedConfig.restaurante.nome = 'Petisbar Teodoro';
  Stores.config.set(storedConfig);
}

// Padroniza os drinks existentes para copos de 500ml sem apagar outros dados do cardápio.
const drinkIds = new Set(SEED_PRODUTOS.filter(p => p.categoria === 'Drinks').map(p => p.id));
const drinkDefaults = new Map(SEED_PRODUTOS.filter(p => drinkIds.has(p.id)).map(p => [p.id, p]));
const storedProducts = Stores.produtos.get();
let productsChanged = false;

storedProducts.forEach(product => {
  const defaults = drinkDefaults.get(product.id);
  if (!defaults) return;
  if (product.nome !== defaults.nome || product.descricao !== defaults.descricao) {
    product.nome = defaults.nome;
    product.descricao = defaults.descricao;
    productsChanged = true;
  }
});

// Substitui os tamanhos antigos de açaí pela batidinha em garrafinha de 300ml.
const acai300 = storedProducts.find(product => product.id === 'p-aca001');
if (acai300) {
  const acaiDefault = SEED_PRODUTOS.find(product => product.id === 'p-aca001');
  const acaiUpdate = {
    nome: acaiDefault.nome,
    descricao: acaiDefault.descricao,
    precoVenda: acaiDefault.precoVenda,
    ativo: true,
  };
  if (Object.entries(acaiUpdate).some(([key, value]) => acai300[key] !== value)) {
    Object.assign(acai300, acaiUpdate);
    productsChanged = true;
  }
}

storedProducts.forEach(product => {
  if (['p-aca002', 'p-aca003', 'p-aca004', 'p-aca005'].includes(product.id) && product.ativo) {
    product.ativo = false;
    productsChanged = true;
  }
});

// Acrescenta fotos representativas também aos produtos já salvos no navegador.
storedProducts.forEach(product => {
  const defaultPhoto = getDefaultProductPhoto(product);
  if (defaultPhoto && product.foto !== defaultPhoto) {
    product.foto = defaultPhoto;
    productsChanged = true;
  }
});

if (productsChanged) Stores.produtos.set(storedProducts);

const iceByProductId = new Map([
  ['p-drk001', 250], ['p-drk002', 250], ['p-drk003', 250],
  ['p-drk004', 250], ['p-drk005', 250], ['p-drk006', 250],
  ['p-drk010', 200], ['p-drk011', 200],
]);
const storedFichas = Stores.fichas.get();
let fichasChanged = false;

storedFichas.forEach(ficha => {
  const iceGrams = iceByProductId.get(ficha.produtoId);
  if (!iceGrams) return;
  let ice = ficha.itens.find(item => item.ingredienteId === 'i-009');
  if (!ice) {
    ice = { ingredienteId: 'i-009', quantidade: iceGrams, unidade: 'g' };
    ficha.itens.push(ice);
    fichasChanged = true;
  } else if (ice.quantidade !== iceGrams || ice.unidade !== 'g') {
    ice.quantidade = iceGrams;
    ice.unidade = 'g';
    fichasChanged = true;
  }
});

if (fichasChanged) Stores.fichas.set(storedFichas);
