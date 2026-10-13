import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

test('salva ficha de receita no ERP preservando vínculos e campos pendentes',async()=>{
  let request;
  const context=vm.createContext({
    window:{location:{hostname:'177-153-67-250.nip.io',search:'',pathname:'/pages/produtos.html'}},
    sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},URLSearchParams,
    fetch:async(url,options)=>{request={url,options};return{ok:true,status:200,json:async()=>({data:{id:'course-prod-02',updated:true}})};},
  });
  vm.runInContext(readFileSync(resolve(import.meta.dirname,'..','..','js','api.js'),'utf8'),context);
  const api=vm.runInContext('API',context);
  await api.saveServerRecipeCard({id:'course-prod-02',name:'Batata recheada',productId:null,status:'draft',outputYield:null,outputUnit:'g',packagingCapacity:500,packagingCapacityUnit:'ml',preparationMethod:'Montar',pendingNotes:'Pesar rendimento',items:[{id:'item-1',itemName:'Batata amassada',ingredientId:null,preparationId:'course-base-01',quantity:250,unit:'g',isPackaging:false,pendingNote:''},{itemName:'Cebolinha',quantity:null,unit:null,isPackaging:false,pendingNote:'Opcional; quantidade não informada.'}]});
  assert.equal(request.url,'/api/v1/recipe-cards/course-prod-02');
  assert.equal(request.options.method,'PUT');
  const body=JSON.parse(request.options.body);
  assert.equal(body.items[0].preparationId,'course-base-01');
  assert.equal(body.items[1].quantity,null);
  assert.match(body.items[1].pendingNote,/quantidade não informada/);
  assert.equal(body.packagingCapacity,500);
});
