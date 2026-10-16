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
    Utils:{escapeHtml:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),productPhoto:()=>'',currency:value=>`R$ ${value}`,currencyCost:value=>`R$ ${value}`},
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
  assert.match(editor.innerHTML,/Preparação: Iscas ao molho de tomate/);
});

test('fichas do curso exibem vínculos existentes sem pedir seleção manual',()=>{
  const editor={innerHTML:'',dataset:{},addEventListener(){}};
  const context=vm.createContext({
    document:{getElementById:id=>id==='ficha-editor'?editor:null,querySelectorAll:()=>[]},
    API:{isServerMode:()=>true,hasPermission:()=>true},
    Storage:{getState:()=>({settings:{}})},Stores:{},
    Utils:{escapeHtml:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),currency:value=>`R$ ${value}`,currencyCost:value=>`R$ ${value}`},
    calcIngredienteCost:()=>null,
  });
  vm.runInContext(readFileSync(resolve(import.meta.dirname,'..','..','js','modules','fichas.js'),'utf8'),context);
  const module=vm.runInContext('FichasModule',context);
  const card={id:'course-base-02',code:'BASE-02',name:'Frango cremoso ao molho de tomate',recipeType:'preparation',status:'incomplete',outputUnit:'g',items:[
    {id:'chicken',itemName:'Frango sassami ou filé de peito',ingredientId:'i-038',quantity:1000,unit:'g',isPackaging:false,pendingNote:''},
    {id:'onion',itemName:'Cebola média/grande',ingredientId:'i-025',quantity:1,unit:'un',isPackaging:false,pendingNote:'Pesar a unidade usada; peso não informado.'},
    {id:'garlic',itemName:'Alho',ingredientId:'i-024',quantity:2,unit:'dente',isPackaging:false,pendingNote:''},
    {id:'passata',itemName:'Passata de tomate',quantity:700,unit:'g',isPackaging:false,pendingNote:'Vínculo ao ingrediente canônico pendente.'},
  ],cost:{complete:false,notes:['Rendimento pendente']}};
  module._serverMode=true;module._canWrite=true;module._receitasCurso=[card];module._ingredientes=[
    {id:'i-038',nome:'Peito de Frango',unidade:'kg'},
    {id:'i-025',nome:'Cebola',unidade:'kg'},
    {id:'i-024',nome:'Alho',unidade:'kg'},
  ];
  module.selectCourseRecipe(card);
  assert.match(editor.innerHTML,/Insumo: Peito de Frango/);
  assert.match(editor.innerHTML,/Insumo: Cebola/);
  assert.match(editor.innerHTML,/Insumo: Alho/);
  assert.match(editor.innerHTML,/Sem vínculo no cadastro de estoque/);
  assert.doesNotMatch(editor.innerHTML,/data-row-field="ingredientId"/);
  assert.doesNotMatch(editor.innerHTML,/data-row-field="preparationId"/);
  assert.doesNotMatch(editor.innerHTML,/type="checkbox"/);
});

test('ficha do produto vendável aceita preparação-base e marca custo parcial',()=>{
  const context=vm.createContext({
    document:{getElementById:()=>null,querySelectorAll:()=>[]},
    API:{isServerMode:()=>true,hasPermission:()=>true},
    Storage:{getState:()=>({settings:{}})},Stores:{},
    Utils:{escapeHtml:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),currency:value=>`R$ ${value}`,currencyCost:value=>`R$ ${value}`},
    UNIDADES:['g','kg','ml','L','un'],
    calcIngredienteCost:(ingredient,quantity,unit)=>ingredient.unidade===unit?quantity*ingredient.custoUnitario:null,
  });
  vm.runInContext(readFileSync(resolve(import.meta.dirname,'..','..','js','modules','fichas.js'),'utf8'),context);
  const module=vm.runInContext('FichasModule',context);
  module._ingredientes=[];
  module._receitasCurso=[{id:'course-base-01',code:'BASE-01',name:'Batata amassada',recipeType:'preparation',status:'incomplete',outputUnit:'g',cost:{unit:null,partialUnit:0.01,complete:false}}];
  const row=module._renderRow({preparacaoId:'course-base-01',quantidade:250,unidade:'g'},0);
  assert.match(row,/value="preparation:course-base-01" selected/);
  assert.match(row,/R\$ 0.01\/g · parcial/);
  assert.match(row,/R\$ 2.5\*/);
});
