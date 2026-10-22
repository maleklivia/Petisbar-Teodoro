import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const context = vm.createContext({ Intl, String });
vm.runInContext(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'js', 'utils.js'), 'utf8'), context);
const displayCategory = vm.runInContext('Utils.displayCategory', context);

test('exibe Batatas Recheadas em título sem alterar as demais categorias', () => {
  assert.equal(displayCategory('BATATAS RECHEADAS'), 'Batatas Recheadas');
  assert.equal(displayCategory('  batatas recheadas  '), 'Batatas Recheadas');
  assert.equal(displayCategory('Petiscos'), 'Petiscos');
});
