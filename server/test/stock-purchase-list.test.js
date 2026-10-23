import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

function loadEstoqueModule() {
  const context = vm.createContext({ Number, Math });
  vm.runInContext(
    readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'js', 'modules', 'estoque.js'), 'utf8'),
    context,
  );
  return vm.runInContext('EstoqueModule', context);
}

test('lista de compras só considera crítico estoque abaixo do ponto de pedido', () => {
  const estoque = loadEstoqueModule();
  const ingredient = stock => ({
    estoqueAtual: stock,
    estoqueMinimo: 50,
    consumoMedioDiario: 0,
    prazoReposicaoDias: 0,
  });

  assert.equal(estoque._precisaComprar(ingredient(49)), true);
  assert.equal(estoque._precisaComprar(ingredient(50)), false);
  assert.equal(estoque._precisaComprar(ingredient(51)), false);
});
