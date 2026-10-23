import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../../',import.meta.url);
const utils=vm.runInNewContext((await readFile(new URL('js/utils.js',root),'utf8'))+';Utils',{Intl,Date,Math,setTimeout,clearTimeout});
test('funções Utils chamadas pelas telas existem',async()=>{
  const files=['app.js','api.js','ui.js',...(await readdir(new URL('js/modules/',root))).filter(f=>f.endsWith('.js')).map(f=>'modules/'+f)];
  for(const file of files){const source=await readFile(new URL('js/'+file,root),'utf8');for(const match of source.matchAll(/Utils\.(\w+)\s*\(/g))assert.equal(typeof utils[match[1]],'function',`${file}: Utils.${match[1]}`);}
});
test('foto do PostgreSQL aparece no editor e URLs executáveis são rejeitadas',()=>{
  assert.match(utils.productPhoto({nome:'Produto',foto:'/api/v1/public/products/p-123/photo?v=abc123'}),/<img /);
  assert.match(utils.productPhoto({nome:'Produto',foto:'../assets/products/soda.jpg'}),/<img /);
  assert.doesNotMatch(utils.productPhoto({nome:'Produto',foto:'javascript:alert(1)'}),/<img /);
});

test('relatórios filtram sete dias e pedidos com o mesmo período sem chamar saldo de margem',async()=>{
  const report=vm.runInNewContext((await readFile(new URL('js/modules/relatorios.js',root),'utf8'))+';RelatoriosModule',{
    Utils:{...utils,today:()=> '2026-10-22',currentMonth:()=> '2026-10'},Date,
  });
  report._serverMode=true;report._periodo='semana';
  report._data={finance:[],deliveredOrderDates:['2026-10-15','2026-10-16','2026-10-22','2026-10-23']};
  assert.equal(report._deliveredOrdersCount(),2);
  assert.equal(report._inPeriod('2026-10-15'),false);
  const html=report._renderVendas();
  assert.match(html,/não é lucro contábil/);assert.doesNotMatch(html,/% margem|Pedidos \(v0.3\)/);
});
