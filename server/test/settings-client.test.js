import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

test('envia configurações do cardápio como JSON ao VPS', async () => {
  let sent;
  const context = vm.createContext({
    fetch: async (url, options) => {
      sent = { url, options };
      return { ok: true, status: 200, json: async () => ({ data: { 'storefront.minimumOrder': 20 } }) };
    },
  });
  const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'js', 'api.js'), 'utf8');
  vm.runInContext(source, context);
  const api = vm.runInContext('API', context);
  await api.saveServerSettings({ 'storefront.minimumOrder': 20 });
  assert.equal(sent.url, '/api/v1/settings');
  assert.equal(sent.options.method, 'PUT');
  assert.equal(sent.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(sent.options.body), { 'storefront.minimumOrder': 20 });
});

test('modo de teste tem controle isolado e não altera as demais configurações', async () => {
  const saved = [];
  const configuration = { 'storefront.isOpen': true, 'storefront.minimumOrder': 20 };
  const context = vm.createContext({
    API: {
      isServerMode: () => true,
      hasPermission: permission => permission === 'settings.manage',
      saveServerSettings: async value => { saved.push(value); },
    },
    Stores: { config: { get: () => configuration, set: value => Object.assign(configuration, value) } },
    UI: { toast() {} },
    Utils: { escapeHtml: value => String(value ?? '') },
    document: { getElementById: () => ({ innerHTML: '' }) },
    localStorage: { getItem: () => null },
  });
  const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'js', 'modules', 'configuracoes.js'), 'utf8');
  vm.runInContext(source, context);
  const module = vm.runInContext('ConfiguracoesModule', context);
  module._storefront = { ...configuration, 'storefront.allowOrdersWithoutStockForTesting': false };
  const html = module._renderStorefront();
  assert.match(html, /id="cfg-test-mode-toggle"/);
  assert.match(html, /Ativar modo de teste/);
  assert.doesNotMatch(html, /name="allowOrdersWithoutStockForTesting"/);
  await module._setStorefrontTestMode({ disabled: false });
  assert.equal(saved.length, 1);
  assert.equal(saved[0]['storefront.allowOrdersWithoutStockForTesting'], true);
  assert.equal(Object.keys(saved[0]).length, 1);
  assert.equal(configuration['storefront.allowOrdersWithoutStockForTesting'], true);
  assert.equal(configuration['storefront.isOpen'], true);
  assert.equal(configuration['storefront.minimumOrder'], 20);
  await module._setStorefrontTestMode({ disabled: false });
  assert.equal(saved.length, 2);
  assert.equal(saved[1]['storefront.allowOrdersWithoutStockForTesting'], false);
  assert.equal(Object.keys(saved[1]).length, 1);
  assert.equal(configuration['storefront.isOpen'], true);
});

test('consulta o estado e as taxas do iFood no endpoint autenticado do VPS', async () => {
  let requestedUrl;
  const context = vm.createContext({
    fetch: async url => {
      requestedUrl = url;
      return { ok: true, status: 200, json: async () => ({ data: {
        commissionPercent: 23, paymentFeePercent: 3.2, totalFeePercent: 26.2,
      } }) };
    },
  });
  const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'js', 'api.js'), 'utf8');
  vm.runInContext(source, context);
  const api = vm.runInContext('API', context);
  const status = await api.getServerIfoodStatus();
  assert.equal(requestedUrl, '/api/v1/integrations/ifood/status');
  assert.equal(status.commissionPercent, 23);
  assert.equal(status.paymentFeePercent, 3.2);
  assert.equal(status.totalFeePercent, 26.2);
});

test('exibe as três taxas sem um campo local de comissão divergente', () => {
  const context = vm.createContext({
    Utils: { escapeHtml: value => String(value) },
    API: {}, Stores: {}, UI: {},
  });
  const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'js', 'modules', 'configuracoes.js'), 'utf8');
  vm.runInContext(source, context);
  const module = vm.runInContext('ConfiguracoesModule', context);
  module._ifoodStatus = { commissionPercent: 23, paymentFeePercent: 3.2, totalFeePercent: 26.2 };
  const html = module._renderMetas({ taxas: { taxaIfood: 15 } });
  assert.match(html, /Comissão publicada do Plano Entrega/);
  assert.match(html, /Taxa publicada para pagamento via iFood/);
  assert.match(html, /Total usado na sugestão de preço/);
  assert.match(html, /3,5% para pagamento via iFood/);
  assert.match(html, /Confira seu contrato no Portal do Parceiro/);
  assert.doesNotMatch(html, /cfg-taxa-ifood|Comissão iFood \(%\)/);
});

test('salvar metas preserva a taxa legada sem voltar a tratá-la como taxa oficial', async () => {
  const config = { taxas: { taxaIfood: 15, taxaEntregaPadrao: 5, comissaoEntregador: 0 } };
  const values = {
    'cfg-cmv-meta': '35', 'cfg-margem-meta': '60', 'cfg-ticket-meta': '60',
    'cfg-inativos-dias': '30', 'cfg-taxa-entrega': '7',
  };
  const context = vm.createContext({
    Stores: { config: { get: () => config, set: value => Object.assign(config, value) } },
    document: { getElementById: id => ({ value: values[id] }) },
    API: { isServerMode: () => false },
    UI: { toast() {} },
  });
  const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'js', 'modules', 'configuracoes.js'), 'utf8');
  vm.runInContext(source, context);
  vm.runInContext('ConfiguracoesModule._salvarMetas()', context);
  assert.equal(config.taxas.taxaIfood, 15);
  assert.equal(config.taxas.taxaEntregaPadrao, 7);
});
