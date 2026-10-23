import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTechnicalSheetCost } from '../src/domain/technical-sheet-costs.js';

test('calcula uma ficha de venda com preparação pronta sem somar ingredientes crus de novo', () => {
  const result=calculateTechnicalSheetCost({
    sheet:{yield:1},
    items:[
      {preparationId:'potato-base',quantity:250,unit:'g',name:'Batata amassada'},
      {preparationId:'chicken-base',quantity:150,unit:'g',name:'Frango cremoso'},
      {ingredientId:'cheese',quantity:50,unit:'g',name:'Muçarela'},
    ],
    ingredients:new Map([['cheese',{id:'cheese',name:'Muçarela',unit:'kg',unitCost:40,active:true}]]),
    preparations:new Map([
      ['potato-base',{id:'potato-base',recipeType:'preparation',name:'Batata amassada',status:'ready',outputYield:1000,outputUnit:'g',cost:{complete:true,unit:0.01}}],
      ['chicken-base',{id:'chicken-base',recipeType:'preparation',name:'Frango cremoso',status:'ready',outputYield:1000,outputUnit:'g',cost:{complete:true,unit:0.02}}],
    ]),
  });
  assert.equal(result.complete,true);
  assert.equal(result.total,7.5);
});

test('mantém custo parcial quando preparação ou custo de ingrediente está incompleto', () => {
  const result=calculateTechnicalSheetCost({
    sheet:{yield:1},items:[
      {preparationId:'potato-base',quantity:250,unit:'g',name:'Batata amassada'},
      {ingredientId:'cheese',quantity:50,unit:'g',name:'Muçarela'},
    ],
    ingredients:new Map([['cheese',{id:'cheese',name:'Muçarela',unit:'kg',unitCost:0,active:true}]]),
    preparations:new Map([['potato-base',{id:'potato-base',recipeType:'preparation',name:'Batata amassada',status:'incomplete',outputYield:null,outputUnit:'g',cost:{complete:false,unit:null}}]]),
  });
  assert.equal(result.complete,false);
  assert.equal(result.total,null);
  assert.equal(result.partialTotal,0);
  assert.equal(result.notes.length,2);
});
