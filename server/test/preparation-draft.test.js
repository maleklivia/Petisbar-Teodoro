import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..', '..');

test('falha no envio mantém o rascunho até o VPS confirmar a gravação', async () => {
  const storage = new Map();
  const status = { textContent: '', dataset: {} };
  const api = { saveServerTechnicalSheet: async () => { throw new Error('offline'); } };
  const context = vm.createContext({
    API: api,
    UI: { toast() {} },
    document: { getElementById: () => status },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    structuredClone,
    Promise,
    Map,
  });
  vm.runInContext(readFileSync(resolve(root, 'js/modules/fichas.js'), 'utf8'), context);
  const fichas = vm.runInContext('FichasModule', context);
  fichas._serverMode = true;
  fichas._activeProdutoId = 'produto-teste';
  const ficha = { id: 'ficha-teste', produtoId: 'produto-teste', modoPreparo: 'Passo a passo', itens: [] };
  const key = fichas._draftKey(ficha.produtoId);
  storage.set(key, JSON.stringify({ modoPreparo: ficha.modoPreparo }));

  fichas._persist(ficha);
  await fichas._saveQueues.get(ficha.produtoId);
  assert.equal(fichas._readDraft(ficha.produtoId), 'Passo a passo');
  assert.equal(status.dataset.state, 'error');

  api.saveServerTechnicalSheet = async submitted => ({ ...submitted, dataAtualizacao: '2026-10-07T00:00:00Z' });
  fichas._persist(ficha);
  await fichas._saveQueues.get(ficha.produtoId);
  assert.equal(storage.has(key), false);
  assert.equal(status.dataset.state, 'saved');
});

test('o endereço do VPS permanece no modo servidor mesmo com parâmetro local', () => {
  const source = readFileSync(resolve(root, 'js/api.js'), 'utf8');
  const sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const context = vm.createContext({
    window: { location: { hostname: '177-153-67-250.nip.io', search: '?local=1' } },
    sessionStorage,
    URLSearchParams,
  });
  vm.runInContext(source, context);
  assert.equal(vm.runInContext('API.isServerMode()', context), true);
  context.window.location.hostname = 'maleklivia.github.io';
  context.window.location.search = '';
  assert.equal(vm.runInContext('API.isServerMode()', context), false);
});
