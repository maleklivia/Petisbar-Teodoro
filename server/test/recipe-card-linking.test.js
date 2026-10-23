import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRecipeComponentLink } from '../src/domain/recipe-card-linking.js';

test('vincula por nome exato à preparação intermediária quando não existe insumo correspondente',()=>{
  const item={itemName:'Iscas de carne ao molho de tomate',ingredientId:null,preparationId:null};
  const result=resolveRecipeComponentLink(item,{preparations:[{id:'course-base-03',name:'Iscas de carne ao molho de tomate'}]});
  assert.equal(result.preparationId,'course-base-03');
  assert.equal(result.ingredientId,null);
});

test('não faz vínculo por nome parcial nem escolhe quando o nome é ambíguo',()=>{
  const item={itemName:'Iscas ao molho',ingredientId:null,preparationId:null};
  assert.equal(resolveRecipeComponentLink(item,{preparations:[{id:'base-03',name:'Iscas de carne ao molho de tomate'}]}).preparationId,null);
  const ambiguous=resolveRecipeComponentLink({...item,itemName:'Iscas de carne ao molho de tomate'}, {
    ingredients:[{id:'i-1',name:'Iscas de carne ao molho de tomate'}],
    preparations:[{id:'base-03',name:'Iscas de carne ao molho de tomate'}],
  });
  assert.equal(ambiguous.ingredientId,null);
  assert.equal(ambiguous.preparationId,null);
});

test('preserva vínculo explícito já cadastrado',()=>{
  const item={itemName:'Iscas',ingredientId:null,preparationId:'base-03'};
  assert.equal(resolveRecipeComponentLink(item,{ingredients:[{id:'i-1',name:'Iscas'}]}).preparationId,'base-03');
});
