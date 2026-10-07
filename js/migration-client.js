const MIGRATION_STORES = {
  // O ERP atual grava o catálogo nestas versões; usar as chaves antigas
  // importava uma lista vazia e deixava o cardápio público incompleto.
  produtos: 'distrito-produtos-v3',
  ingredientes: 'distrito-ingredientes-v2',
  fichas: 'distrito-fichas-v2',
  pedidos: 'distrito-pedidos-v1',
  clientes: 'distrito-clientes-v1',
  fornecedores: 'distrito-fornecedores-v1',
  compras: 'distrito-compras-v1',
  movimentacoes: 'distrito-movimentacoes-v1',
  cupons: 'distrito-cupons-v1',
  documentos: 'distrito-documentos-v1',
  config: 'distrito-config-v1',
};

function readLocalSnapshot() {
  const stores = Object.fromEntries(Object.entries(MIGRATION_STORES).map(([name, key]) => {
    try { return [name, JSON.parse(localStorage.getItem(key) || (name === 'config' ? '{}' : '[]'))]; }
    catch { return [name, name === 'config' ? {} : []]; }
  }));
  try {
    const legacy = JSON.parse(localStorage.getItem('distrito-os-v5') || '{}');
    stores.financeiro = Array.isArray(legacy.finance) ? legacy.finance : [];
  } catch {
    stores.financeiro = [];
  }
  return stores;
}

const snapshot = readLocalSnapshot();
const preview = document.getElementById('migration-preview');
const status = document.getElementById('migration-status');
const counts = Object.entries(snapshot)
  .filter(([, value]) => Array.isArray(value))
  .map(([name, value]) => `<div><strong>${value.length}</strong> ${name}</div>`).join('');
preview.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:var(--sp-2)">${counts}</div>`;

document.getElementById('migration-start').addEventListener('click', async () => {
  const button = document.getElementById('migration-start');
  const baseUrl = document.getElementById('migration-api').value.trim().replace(/\/$/, '');
  const email = document.getElementById('migration-email').value.trim();
  const password = document.getElementById('migration-password').value;
  if (!baseUrl.startsWith('https://')) {
    status.textContent = 'Preencha uma URL HTTPS válida para a API.';
    return;
  }

  button.disabled = true;
  status.textContent = 'Autenticando…';
  try {
    if (email || password) {
      if (!email || !password) throw new Error('Preencha e-mail e senha ou deixe os dois vazios para usar a sessão já aberta.');
      const login = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!login.ok) throw new Error('Não foi possível entrar. Confira e-mail, senha e endereço da API.');
    }

    status.textContent = 'Importando dados…';
    const response = await fetch(`${baseUrl}/migration/local-storage`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error('A API recusou a importação. Nenhum dado local foi apagado.');
    status.innerHTML = result.duplicate
      ? '<span style="color:var(--color-warning)">Este mesmo conjunto já havia sido importado.</span>'
      : '<span style="color:var(--color-success)">Importação concluída. Os dados locais foram preservados para conferência.</span>';
    document.getElementById('migration-password').value = '';
  } catch (error) {
    status.innerHTML = `<span style="color:var(--color-danger)">${error.message}</span>`;
  } finally {
    button.disabled = false;
  }
});
