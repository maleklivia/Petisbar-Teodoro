import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSE_POTATO_RECIPES, calculateRecipeCardCosts, seedCoursePotatoRecipes } from '../src/domain/course-potato-recipes.js';

const byCode=code=>COURSE_POTATO_RECIPES.find(recipe=>recipe.code===code);
const totalKnown=recipe=>recipe.items.reduce((total,item)=>total+(Number.isFinite(item[1])&&!item[5]?item[1]:0),0);

test('preserva os totais confirmados das três montagens do curso',()=>{
  assert.equal(totalKnown(byCode('PROD-01')),515);
  assert.equal(totalKnown(byCode('PROD-02')),525);
  assert.equal(totalKnown(byCode('PROD-03')),495);
});

test('transcreve seis preparações-base e onze produtos, mantendo duas bases auxiliares em rascunho',()=>{
  assert.equal(COURSE_POTATO_RECIPES.filter(recipe=>recipe.code.startsWith('BASE-')).length,6);
  assert.equal(COURSE_POTATO_RECIPES.filter(recipe=>recipe.code.startsWith('PROD-')).length,11);
  assert.equal(COURSE_POTATO_RECIPES.filter(recipe=>recipe.code.startsWith('PEND-')).length,2);
  assert.equal(byCode('PROD-03').status,'draft');
  assert.equal(byCode('PROD-05').status,'draft');
});

test('preparações dividem custo do lote pelo rendimento e não inventam custo final incompleto',()=>{
  const complete={id:'prep',code:'BASE-X',recipeType:'preparation',status:'ready',outputYield:800,items:[
    {itemName:'Batata',ingredientId:'i1',preparationId:null,quantity:1000,unit:'g',isPackaging:false,pendingNote:''},
  ],ingredientsById:new Map([['i1',{unit:'g',unitCost:.005}]])};
  const incomplete={id:'draft',code:'BASE-Y',recipeType:'preparation',status:'incomplete',outputYield:null,items:[
    {itemName:'Batata',ingredientId:'i1',preparationId:null,quantity:1000,unit:'g',isPackaging:false,pendingNote:''},
    {itemName:'Sal',ingredientId:null,preparationId:null,quantity:null,unit:null,isPackaging:false,pendingNote:'A gosto.'},
  ],ingredientsById:complete.ingredientsById};
  const [ready,draft]=calculateRecipeCardCosts([complete,incomplete]);
  assert.equal(ready.cost.total,5);
  assert.equal(ready.cost.unit,5/800);
  assert.equal(draft.cost.complete,false);
  assert.equal(draft.cost.total,null);
  assert.equal(draft.cost.partialTotal,5);
  assert.ok(draft.cost.notes.some(note=>note.toLowerCase().includes('rendimento')));
});

test('produto calcula o componente pronto e não soma novamente os ingredientes crus da preparação',()=>{
  const ingredients=new Map([['i-potato',{unit:'g',unitCost:.005}],['i-cheese',{unit:'g',unitCost:.01}]]);
  const prep={id:'prep',code:'BASE',recipeType:'preparation',status:'ready',outputYield:800,items:[
    {itemName:'Batata crua',ingredientId:'i-potato',preparationId:null,quantity:1000,unit:'g',isPackaging:false,pendingNote:''},
  ],ingredientsById:ingredients};
  const product={id:'product',code:'PROD',recipeType:'product',status:'ready',outputYield:1,items:[
    {itemName:'Batata amassada',ingredientId:null,preparationId:'prep',quantity:250,unit:'g',isPackaging:false,pendingNote:''},
    {itemName:'Queijo',ingredientId:'i-cheese',preparationId:null,quantity:50,unit:'g',isPackaging:false,pendingNote:''},
  ],ingredientsById:ingredients};
  const result=calculateRecipeCardCosts([prep,product])[1].cost;
  assert.equal(result.complete,true);
  assert.equal(result.total,2.0625);
});

test('transcrição mantém embalagens separadas, capacidade em ml e ingredientes pendentes explícitos',()=>{
  const potato=byCode('BASE-01');
  assert.equal(potato.items.find(item=>item[0]==='Manteiga')[1],100);
  assert.equal(potato.items.some(item=>item[0]==='Leite'),false);
  const chicken=byCode('PROD-01');
  const packaging=chicken.items.find(item=>item[5]);
  assert.deepEqual(packaging.slice(0,3),['Cumbuca térmica 500 ml',1,'un']);
  assert.equal(chicken.packagingCapacity,500);
  assert.equal(chicken.packagingCapacityUnit,'ml');
  assert.equal(chicken.items.find(item=>item[0]==='Cebolinha')[1],null);
  assert.equal(COURSE_POTATO_RECIPES.some(recipe=>/molho branco/i.test(recipe.name)),false);
});

test('importação pode ser repetida sem duplicar fichas ou componentes',async()=>{
  const recipes=new Map(),items=new Map();
  const client={async query(sql,params=[]){
    if(sql.includes('INSERT INTO recipe_cards')){recipes.set(params[1],params[0]);return {rowCount:1};}
    if(sql.includes('SELECT 1 FROM recipe_card_items WHERE recipe_id=$1 LIMIT 1'))return {rowCount:[...items.values()].some(item=>item.recipeId===params[0])?1:0};
    if(sql.includes('INSERT INTO recipe_card_items')){items.set(params[0],{recipeId:params[1]});return {rowCount:1};}
    throw new Error(`Consulta inesperada no teste: ${sql}`);
  }};
  await seedCoursePotatoRecipes(client);
  const firstItemCount=items.size;
  await seedCoursePotatoRecipes(client);
  assert.equal(recipes.size,19); // 6 bases + 2 bases ainda pendentes + 11 produtos
  assert.equal(items.size,firstItemCount);
});
