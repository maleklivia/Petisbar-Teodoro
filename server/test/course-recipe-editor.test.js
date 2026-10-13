import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

test('apresenta receita importada na navegação e no editor padrão de ficha técnica',()=>{
  const sidebar={innerHTML:'',querySelectorAll:()=>[]};
  const editor={innerHTML:'',dataset:{},addEventListener(){}};
  const context=vm.createContext({
    document:{getElementById:id=>id==='ficha-produto-list'?sidebar:editor,querySelectorAll:()=>[]},
    API:{isServerMode:()=>true,hasPermission:()=>true},
    Storage:{getState:()=>({settings:{}})},Stores:{},
    Utils:{escapeHtml:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),productPhoto:()=>'',currency:value=>`R$ ${value}`},
    calcIngredienteCost:()=>null,
  });
  vm.runInContext(readFileSync(resolve(import.meta.dirname,'..','..','js','modules','fichas.js'),'utf8'),context);
  const module=vm.runInContext('FichasModule',context);
  const card={id:'course-prod-02',code:'PROD-02',name:'Batata de iscas aos quatro queijos',recipeType:'product',status:'incomplete',items:[{id:'item-1',itemName:'Iscas ao molho',preparationId:'course-base-03',quantity:150,unit:'g',isPackaging:false,pendingNote:''}],cost:{complete:false,notes:['Rendimento pendente']}};
  module._serverMode=true;module._canWrite=true;module._receitasCurso=[{id:'course-base-03',code:'BASE-03',name:'Iscas ao molho de tomate',recipeType:'preparation',status:'incomplete',items:[]},card];module._ingredientes=[];module._allProdutos=[];
  module._renderProdutoList([]);
  assert.match(sidebar.innerHTML,/Preparações e receitas/);
  assert.match(sidebar.innerHTML,/Batata de iscas aos quatro queijos/);
  module.selectCourseRecipe(card);
  assert.match(editor.innerHTML,/class="ficha-table"/);
  assert.match(editor.innerHTML,/Modo de preparo/);
  assert.match(editor.innerHTML,/BASE-03 · Iscas ao molho de tomate/);
});
