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
