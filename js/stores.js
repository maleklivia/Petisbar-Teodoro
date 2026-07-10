/* ============================================================
   Distrito OS — Stores v0.2
   Armazenamento separado por domínio: Produtos, Ingredientes,
   Fichas Técnicas. Cada store é independente do storage.js
   legado (que persiste pedidos, finanças, clientes, etc.).
   ============================================================ */

const STORE_KEYS = {
  PRODUTOS:     'distrito-produtos-v1',
  INGREDIENTES: 'distrito-ingredientes-v1',
  FICHAS:       'distrito-fichas-v1',
};

/* ── Domínio: Categorias e Unidades ──────────────────────────── */

const CATEGORIAS_PRODUTO = [
  'Batatas', 'Caldos', 'Aperitivos', 'Pratos', 'Combos', 'Bebidas', 'Sobremesas', 'Outros',
];

const CATEGORIAS_INGREDIENTE = [
  'Proteínas', 'Vegetais', 'Laticínios', 'Grãos e Farinhas',
  'Temperos', 'Embalagens', 'Bebidas', 'Outros',
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

/* ── Seed Data ───────────────────────────────────────────────── */

const SEED_PRODUTOS = [
  {
    id: 'p-001', nome: 'Batata Cheddar', categoria: 'Batatas',
    descricao: 'Batata frita crocante com molho cheddar cremoso',
    precoVenda: 38, ativo: true, tempoPreparo: 12, peso: 350,
    codigo: 'BAT-CH', dataCadastro: '2026-07-01', foto: '',
  },
  {
    id: 'p-002', nome: 'Batata Bacon', categoria: 'Batatas',
    descricao: 'Batata frita com bacon crocante e cebolinha',
    precoVenda: 42, ativo: true, tempoPreparo: 12, peso: 370,
    codigo: 'BAT-BA', dataCadastro: '2026-07-01', foto: '',
  },
  {
    id: 'p-003', nome: 'Caldo Verde', categoria: 'Caldos',
    descricao: 'Caldo cremoso de couve com linguiça artesanal',
    precoVenda: 28, ativo: true, tempoPreparo: 8, peso: 300,
    codigo: 'CAL-VR', dataCadastro: '2026-07-01', foto: '',
  },
  {
    id: 'p-004', nome: 'Bolinho de Aipim', categoria: 'Aperitivos',
    descricao: 'Bolinho crocante de aipim recheado com queijo',
    precoVenda: 32, ativo: true, tempoPreparo: 15, peso: 250,
    codigo: 'APE-AI', dataCadastro: '2026-07-01', foto: '',
  },
  {
    id: 'p-005', nome: 'Combo Família', categoria: 'Combos',
    descricao: 'Batata grande + 2 caldos + 2 refrigerantes',
    precoVenda: 89, ativo: true, tempoPreparo: 20, peso: 1200,
    codigo: 'COM-FA', dataCadastro: '2026-07-01', foto: '',
  },
];

const SEED_INGREDIENTES = [
  { id: 'i-001', nome: 'Batata Palito',     categoria: 'Vegetais',   unidade: 'kg', estoqueAtual: 12,  estoqueMinimo: 5,  custoUnitario: 4.50,  fornecedor: 'Supra Hortifrutti',      ativo: true },
  { id: 'i-002', nome: 'Cheddar Cremoso',   categoria: 'Laticínios', unidade: 'kg', estoqueAtual: 1.5, estoqueMinimo: 3,  custoUnitario: 22.00, fornecedor: 'Distribuidora Cheddar+', ativo: true },
  { id: 'i-003', nome: 'Bacon Fatiado',     categoria: 'Proteínas',  unidade: 'kg', estoqueAtual: 0.8, estoqueMinimo: 2,  custoUnitario: 38.00, fornecedor: 'Frigorífico São Jorge',  ativo: true },
  { id: 'i-004', nome: 'Aipim',             categoria: 'Vegetais',   unidade: 'kg', estoqueAtual: 6,   estoqueMinimo: 3,  custoUnitario: 3.80,  fornecedor: 'Supra Hortifrutti',      ativo: true },
  { id: 'i-005', nome: 'Couve',             categoria: 'Vegetais',   unidade: 'kg', estoqueAtual: 3,   estoqueMinimo: 2,  custoUnitario: 5.20,  fornecedor: 'Supra Hortifrutti',      ativo: true },
  { id: 'i-006', nome: 'Óleo de Soja',      categoria: 'Temperos',   unidade: 'L',  estoqueAtual: 8,   estoqueMinimo: 3,  custoUnitario: 7.50,  fornecedor: '',                       ativo: true },
  { id: 'i-007', nome: 'Costela Bovina',    categoria: 'Proteínas',  unidade: 'kg', estoqueAtual: 2,   estoqueMinimo: 4,  custoUnitario: 48.00, fornecedor: 'Frigorífico São Jorge',  ativo: true },
  { id: 'i-008', nome: 'Refrigerante 350ml',categoria: 'Bebidas',    unidade: 'un', estoqueAtual: 36,  estoqueMinimo: 12, custoUnitario: 2.50,  fornecedor: 'Bebidas & Cia',          ativo: true },
];

const SEED_FICHAS = [
  {
    id: 'f-001', produtoId: 'p-001', rendimento: 1,
    itens: [
      { ingredienteId: 'i-001', quantidade: 0.25, unidade: 'kg' },
      { ingredienteId: 'i-002', quantidade: 0.08, unidade: 'kg' },
      { ingredienteId: 'i-006', quantidade: 0.05, unidade: 'L'  },
    ],
  },
  {
    id: 'f-002', produtoId: 'p-002', rendimento: 1,
    itens: [
      { ingredienteId: 'i-001', quantidade: 0.25, unidade: 'kg' },
      { ingredienteId: 'i-003', quantidade: 0.06, unidade: 'kg' },
      { ingredienteId: 'i-006', quantidade: 0.05, unidade: 'L'  },
    ],
  },
  {
    id: 'f-003', produtoId: 'p-003', rendimento: 1,
    itens: [
      { ingredienteId: 'i-005', quantidade: 0.10, unidade: 'kg' },
    ],
  },
  {
    id: 'f-004', produtoId: 'p-004', rendimento: 1,
    itens: [
      { ingredienteId: 'i-004', quantidade: 0.12, unidade: 'kg' },
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
    origem: 'WhatsApp', clienteId: 'cli-001', clienteNome: 'Ana Lima',
    status: 'Entregue',
    itens: [{ produtoId: 'p-001', nome: 'Batata Cheddar', qty: 2, precoUnitario: 38, subtotal: 76 }],
    subtotal: 76, taxaEntrega: 5, desconto: 0, total: 81,
    formaPagamento: 'PIX', observacoes: '',
    dataCriacao: '2026-07-10T10:00:00.000Z', dataAtualizacao: '2026-07-10T11:30:00.000Z',
  },
  {
    id: 'ped-002', numeroPedido: 2,
    origem: 'iFood', clienteId: 'cli-002', clienteNome: 'Carlos Matos',
    status: 'Entregue',
    itens: [{ produtoId: 'p-005', nome: 'Combo Família', qty: 1, precoUnitario: 89, subtotal: 89 }],
    subtotal: 89, taxaEntrega: 0, desconto: 5, total: 84,
    formaPagamento: 'iFood', observacoes: '',
    dataCriacao: '2026-07-10T11:00:00.000Z', dataAtualizacao: '2026-07-10T12:45:00.000Z',
  },
  {
    id: 'ped-003', numeroPedido: 3,
    origem: 'Balcão', clienteId: null, clienteNome: 'Balcão',
    status: 'Em Produção',
    itens: [
      { produtoId: 'p-002', nome: 'Batata Bacon',  qty: 1, precoUnitario: 42, subtotal: 42 },
      { produtoId: 'p-003', nome: 'Caldo Verde',   qty: 2, precoUnitario: 28, subtotal: 56 },
    ],
    subtotal: 98, taxaEntrega: 0, desconto: 0, total: 98,
    formaPagamento: 'Dinheiro', observacoes: 'Sem bacon no caldo',
    dataCriacao: '2026-07-10T13:00:00.000Z', dataAtualizacao: '2026-07-10T13:15:00.000Z',
  },
  {
    id: 'ped-004', numeroPedido: 4,
    origem: 'Instagram', clienteId: 'cli-003', clienteNome: 'Fernanda Costa',
    status: 'Aguardando Pagamento',
    itens: [{ produtoId: 'p-004', nome: 'Bolinho de Aipim', qty: 2, precoUnitario: 32, subtotal: 64 }],
    subtotal: 64, taxaEntrega: 8, desconto: 0, total: 72,
    formaPagamento: 'PIX', observacoes: '',
    dataCriacao: '2026-07-10T13:30:00.000Z', dataAtualizacao: '2026-07-10T13:30:00.000Z',
  },
  {
    id: 'ped-005', numeroPedido: 5,
    origem: 'WhatsApp', clienteId: 'cli-001', clienteNome: 'Ana Lima',
    status: 'Novo',
    itens: [{ produtoId: 'p-001', nome: 'Batata Cheddar', qty: 1, precoUnitario: 38, subtotal: 38 }],
    subtotal: 38, taxaEntrega: 5, desconto: 0, total: 43,
    formaPagamento: 'Cartão Crédito', observacoes: 'Capricha no molho!',
    dataCriacao: '2026-07-10T14:00:00.000Z', dataAtualizacao: '2026-07-10T14:00:00.000Z',
  },
];

/* ── Seed Data: Clientes ─────────────────────────────────────── */

const SEED_CLIENTES = [
  {
    id: 'cli-001', nome: 'Ana Lima',
    telefone: '(11) 99999-0001', email: 'ana.lima@email.com', cpf: '',
    observacoes: 'Cliente fiel, sempre pede cheddar',
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
    observacoes: 'Alérgica a bacon',
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
  { id: 'for-001', nome: 'Supra Hortifrutti', cnpj: '', telefone: '(11) 9 9999-0003', email: '', contato: '', categoria: 'Hortifruti', prazoEntrega: 1, condicoesPagamento: 'À vista', observacoes: 'Pedido na segunda', ativo: true, dataCadastro: '2026-07-01' },
  { id: 'for-002', nome: 'Frigorífico São Jorge', cnpj: '', telefone: '(11) 9 9999-0001', email: '', contato: '', categoria: 'Carnes', prazoEntrega: 2, condicoesPagamento: '30 dias', observacoes: 'Entrega ter/qui', ativo: true, dataCadastro: '2026-07-01' },
  { id: 'for-003', nome: 'Distribuidora Cheddar+', cnpj: '', telefone: '(11) 9 9999-0002', email: '', contato: '', categoria: 'Laticínios', prazoEntrega: 3, condicoesPagamento: '15 dias', observacoes: 'Pedir 2 dias antes', ativo: true, dataCadastro: '2026-07-01' },
  { id: 'for-004', nome: 'Bebidas & Cia', cnpj: '', telefone: '(11) 9 9999-0004', email: '', contato: '', categoria: 'Bebidas', prazoEntrega: 2, condicoesPagamento: 'À vista', observacoes: 'Mín. 2 caixas', ativo: true, dataCadastro: '2026-07-01' },
  { id: 'for-005', nome: 'Embalagem Pro', cnpj: '', telefone: '(11) 9 9999-0005', email: '', contato: '', categoria: 'Embalagens', prazoEntrega: 5, condicoesPagamento: 'À vista', observacoes: 'A cada 2 semanas', ativo: true, dataCadastro: '2026-07-01' },
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
      { ingredienteId: 'i-001', nome: 'Batata Palito', quantidade: 10, unidade: 'kg', custoUnitario: 4.50, subtotal: 45 },
      { ingredienteId: 'i-005', nome: 'Couve', quantidade: 3, unidade: 'kg', custoUnitario: 5.20, subtotal: 15.60 },
    ],
    total: 60.60, observacoes: '',
    dataCompra: '2026-07-03', dataRecebimento: '2026-07-03',
    notaFiscal: '', formaPagamento: 'À vista',
  },
  {
    id: 'cmp-002', numeroPedidoCompra: 2,
    fornecedorId: 'for-002', fornecedorNome: 'Frigorífico São Jorge',
    status: 'Recebido', tipo: 'manual',
    itens: [
      { ingredienteId: 'i-003', nome: 'Bacon Fatiado', quantidade: 3, unidade: 'kg', custoUnitario: 38, subtotal: 114 },
      { ingredienteId: 'i-007', nome: 'Costela Bovina', quantidade: 5, unidade: 'kg', custoUnitario: 48, subtotal: 240 },
    ],
    total: 354, observacoes: '',
    dataCompra: '2026-07-02', dataRecebimento: '2026-07-02',
    notaFiscal: '', formaPagamento: '30 dias',
  },
  {
    id: 'cmp-003', numeroPedidoCompra: 3,
    fornecedorId: 'for-003', fornecedorNome: 'Distribuidora Cheddar+',
    status: 'Aprovado', tipo: 'automatico',
    itens: [
      { ingredienteId: 'i-002', nome: 'Cheddar Cremoso', quantidade: 5, unidade: 'kg', custoUnitario: 22, subtotal: 110 },
    ],
    total: 110, observacoes: 'Estoque crítico — gerado automaticamente',
    dataCompra: '2026-07-10', dataRecebimento: '',
    notaFiscal: '', formaPagamento: '15 dias',
  },
];

/* ── Seed Data: Movimentações de Estoque ─────────────────────── */

const TIPOS_MOVIMENTACAO = ['entrada', 'saída', 'ajuste', 'perda'];

const SEED_MOVIMENTACOES = [
  { id: 'mov-001', tipo: 'entrada', ingredienteId: 'i-001', ingredienteNome: 'Batata Palito', quantidade: 10, unidade: 'kg', motivo: 'compra', referencia: 'cmp-001', data: '2026-07-03', usuario: 'admin' },
  { id: 'mov-002', tipo: 'entrada', ingredienteId: 'i-005', ingredienteNome: 'Couve', quantidade: 3, unidade: 'kg', motivo: 'compra', referencia: 'cmp-001', data: '2026-07-03', usuario: 'admin' },
  { id: 'mov-003', tipo: 'entrada', ingredienteId: 'i-003', ingredienteNome: 'Bacon Fatiado', quantidade: 3, unidade: 'kg', motivo: 'compra', referencia: 'cmp-002', data: '2026-07-02', usuario: 'admin' },
  { id: 'mov-004', tipo: 'entrada', ingredienteId: 'i-007', ingredienteNome: 'Costela Bovina', quantidade: 5, unidade: 'kg', motivo: 'compra', referencia: 'cmp-002', data: '2026-07-02', usuario: 'admin' },
  { id: 'mov-005', tipo: 'saída', ingredienteId: 'i-003', ingredienteNome: 'Bacon Fatiado', quantidade: 2.2, unidade: 'kg', motivo: 'venda', referencia: 'ped-001', data: '2026-07-09', usuario: 'sistema' },
  { id: 'mov-006', tipo: 'saída', ingredienteId: 'i-007', ingredienteNome: 'Costela Bovina', quantidade: 3, unidade: 'kg', motivo: 'venda', referencia: 'ped-002', data: '2026-07-08', usuario: 'sistema' },
];

/* ── Seed Data: Cupons ───────────────────────────────────────── */

const SEED_CUPONS = [
  { id: 'cup-001', codigo: 'BEMVINDO10', tipo: 'percentual', valor: 10, ativo: true, usos: 3, limite: 100, validade: '2026-12-31', descricao: 'Desconto de boas-vindas para novos clientes' },
  { id: 'cup-002', codigo: 'FIDELIDADE5', tipo: 'fixo', valor: 5, ativo: true, usos: 12, limite: 50, validade: '2026-09-30', descricao: 'Desconto fidelidade R$ 5' },
];

/* ── Seed Data: Documentos ───────────────────────────────────── */

const CATS_DOCUMENTO = ['Alvará', 'Contrato', 'Fiscal', 'Manual', 'Receita', 'Outros'];

const SEED_DOCUMENTOS = [
  { id: 'doc-001', titulo: 'Alvará de Funcionamento 2026', categoria: 'Alvará', data: '2026-01-15', link: '', notas: 'Válido até 31/12/2026', dataCadastro: '2026-07-01' },
  { id: 'doc-002', titulo: 'AVCB — Corpo de Bombeiros', categoria: 'Alvará', data: '2025-08-20', link: '', notas: 'Renovar em ago/2026', dataCadastro: '2026-07-01' },
  { id: 'doc-003', titulo: 'Manual de Boas Práticas de Manipulação', categoria: 'Manual', data: '2026-01-01', link: '', notas: '', dataCadastro: '2026-07-01' },
];

/* ── Seed Data: Configurações ────────────────────────────────── */

const SEED_CONFIG = {
  restaurante: { nome: 'Distrito XVII', cnpj: '', telefone: '', email: '', endereco: '', cidade: 'São Paulo', estado: 'SP', cep: '' },
  metas: { cmvMeta: 35, margemMeta: 60, ticketMedioMeta: 60, clientesInativosDias: 30 },
  taxas: { taxaEntregaPadrao: 5, taxaIfood: 15, comissaoEntregador: 0 },
  horario: {
    segunda: 'Fechado', terca: '18:00 – 23:00', quarta: '18:00 – 23:00',
    quinta: '18:00 – 23:00', sexta: '18:00 – 00:00',
    sabado: '12:00 – 00:00', domingo: '12:00 – 22:00',
  },
  integracoes: { whatsapp: false, pix: false, impressora: false, ifood: false, ocr: false },
};

/* ── Stores ──────────────────────────────────────────────────── */

const Stores = {
  produtos:      makeStore(STORE_KEYS.PRODUTOS,          SEED_PRODUTOS),
  ingredientes:  makeStore(STORE_KEYS.INGREDIENTES,      SEED_INGREDIENTES),
  fichas:        makeStore(STORE_KEYS.FICHAS,            SEED_FICHAS),
  pedidos:       makeStore(STORE_KEYS_V3.PEDIDOS,        SEED_PEDIDOS),
  clientes:      makeStore(STORE_KEYS_V3.CLIENTES,       SEED_CLIENTES),
  fornecedores:  makeStore(STORE_KEYS_V4.FORNECEDORES,   SEED_FORNECEDORES),
  compras:       makeStore(STORE_KEYS_V4.COMPRAS,        SEED_COMPRAS),
  movimentacoes: makeStore(STORE_KEYS_V4.MOVIMENTACOES,  SEED_MOVIMENTACOES),
  cupons:        makeStore(STORE_KEYS_V4.CUPONS,         SEED_CUPONS),
  documentos:    makeStore(STORE_KEYS_V4.DOCUMENTOS,     SEED_DOCUMENTOS),
  config:        makeStore(STORE_KEYS_V4.CONFIG,         SEED_CONFIG),
};
