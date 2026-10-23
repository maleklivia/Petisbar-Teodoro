import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

test('formata custos unitários abaixo de um centavo sem ocultar a fração',()=>{
  const context=vm.createContext({Intl});
  vm.runInContext(readFileSync(resolve(import.meta.dirname,'..','..','js','utils.js'),'utf8'),context);
  const value=vm.runInContext('Utils.currencyCost(0.00384458)',context);
  assert.match(value,/0,003845/);
});
