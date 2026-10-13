// Recipe transcription from the user's purchased course. Quantities and units
// are kept as published; null quantities always carry an explicit pending note.
export const COURSE_POTATO_RECIPES = [
  { id:'course-base-01',code:'BASE-01',type:'preparation',name:'Batata cozida e amassada com manteiga',status:'incomplete',yield:null,yieldUnit:'g',method:'Descascar e cortar se desejado. Cobrir com água, acrescentar temperos e cozinhar na pressão por aproximadamente 20 minutos após pegar pressão. Retirar a pressão com segurança. Para armazenar já amassada, retirar a água, acrescentar manteiga e amassar ainda quente.',pending:'Pesar o rendimento pronto. Confirmar se 1.000 g de batata é o peso antes ou depois de descascar. Sal, louro e demais temperos estão a gosto; água suficiente para cobrir. Esta base não leva leite.',items:[
    ['Batata Inglesa',1000,'g',''],['Manteiga',100,'g',''],['Água de cozimento',null,null,'Quantidade suficiente para cobrir; não quantificada.'],['Sal',null,null,'A gosto; quantidade não informada.'],['Louro e demais temperos',null,null,'A gosto; quantidades não informadas.'],
  ]},
  { id:'course-base-02',code:'BASE-02',type:'preparation',name:'Frango cremoso ao molho de tomate',status:'incomplete',yield:null,yieldUnit:'g',method:'Refogar cebola, alho e temperos; adicionar frango em cubos e dourar. Acrescentar passata, tampar e cozinhar na pressão por 7 a 10 minutos. Desligar, aguardar a retirada segura da pressão e desfiar.',pending:'Pesar o rendimento pronto. O exemplo de 1.100 g do capítulo de custos não é rendimento confirmado. Cebola e alho devem ser pesados; louro, coentro e tempero sabor frango estão sem quantidade. A gordura de refogado não foi quantificada; incluir somente se usada na produção.',items:[
    ['Frango sassami ou filé de peito',1000,'g','O curso permite escolher sassami ou filé de peito; vincular ao ingrediente efetivamente comprado.'],['Cebola média/grande',1,'un','Pesar a unidade usada; peso não informado.'],['Alho',2,'dente','Pesar os dentes usados; peso não informado.'],['Passata de tomate',700,'g',''],['Louro, coentro e tempero sabor frango',null,null,'A quantidade está a definir.'],['Gordura de refogado (se utilizada)',null,null,'O material não quantifica; registrar somente se usada.'],
  ]},
  { id:'course-base-03',code:'BASE-03',type:'preparation',name:'Iscas de carne ao molho de tomate',status:'incomplete',yield:null,yieldUnit:'g',method:'Refogar cebola, alho e temperos. Acrescentar as iscas e dourar. Adicionar passata e água; cozinhar na pressão por 5 a 10 minutos.',pending:'Pesar o rendimento pronto. Cebola e alho devem ser pesados; páprica defumada, chimichurri e tempero sabor carne estão sem quantidade. Incluir gordura de refogado caso utilizada. Esta é uma base ao molho de tomate, não ao molho branco.',items:[
    ['Carne magra e macia em iscas',1000,'g',''],['Cebola',1.5,'un','Pesar as unidades; peso não informado.'],['Alho',3,'dente','Pesar os dentes; peso não informado.'],['Passata de tomate',700,'g',''],['Água',100,'ml','Preservada em ml; não converter para g.'],['Páprica defumada, chimichurri e tempero sabor carne',null,null,'A quantidade está a definir.'],['Gordura de refogado (se utilizada)',null,null,'O material não quantifica; registrar somente se usada.'],
  ]},
  { id:'course-base-04',code:'BASE-04',type:'preparation',name:'Calabresa ao molho',status:'incomplete',yield:null,yieldUnit:'g',method:'Refogar calabresa em cubos com cebola e alho. Acrescentar passata e água e cozinhar em fogo médio por 5 a 10 minutos.',pending:'Pesar o rendimento pronto. Cebola e alho devem ser pesados; sal a gosto. A passata desta receita está em ml. Não converter para gramas sem pesagem/conversão cadastrada.',items:[
    ['Calabresa',1000,'g',''],['Cebola',1,'un','Pesar a unidade; peso não informado.'],['Alho',2,'dente','Pesar os dentes; peso não informado.'],['Passata de tomate',300,'ml','O curso informa ml; não converter para g.'],['Água',100,'ml',''],['Sal',null,null,'A gosto; quantidade não informada.'],
  ]},
  { id:'course-base-05',code:'BASE-05',type:'preparation',name:'Bacon dourado e escorrido',status:'incomplete',yield:null,yieldUnit:'g',method:'Fritar o bacon em frigideira quente até dourar, sem necessidade de óleo ou temperos. Escorrer a gordura antes de armazenar.',pending:'A quantidade crua do lote não foi definida. Pesar a quantidade efetivamente usada e pesar o bacon pronto após fritura e drenagem; não usar o peso cru como rendimento.',items:[
    ['Bacon com baixo ou médio teor de gordura',null,'g','Quantidade de lote não definida; pesar o bacon cru efetivamente usado.'],
  ]},
  { id:'course-base-06',code:'BASE-06',type:'preparation',name:'Molho de cheddar',status:'incomplete',yield:null,yieldUnit:'g',method:'Bater os ingredientes no liquidificador por aproximadamente três minutos. O e-book não indica cozimento.',pending:'Pesar ou medir o rendimento pronto. Conferir a unidade do creme de leite adquirido; 200 g não equivale automaticamente a 200 ml.',items:[
    ['Cheddar cremoso de bisnaga',1500,'g','Confirmar o vínculo com o insumo cadastrado.'],['Creme de leite',200,'ml','Preservada em ml; conferir unidade do produto comprado.'],['Leite',500,'ml','Preservada em ml.'],
  ]},
  { id:'course-prep-stroganoff',code:'PEND-STROG',type:'preparation',name:'Strogonoff de carne — receita intermediária pendente',status:'draft',yield:null,yieldUnit:'g',method:'O curso orienta finalizar BASE-03 na frigideira com creme de leite, mostarda e muçarela.',pending:'O curso não informa as quantidades desses ingredientes nem o rendimento. Não cadastrar quantidades presumidas; ficha fica em rascunho até teste e pesagem.',items:[
    ['BASE-03 — Iscas de carne ao molho de tomate',null,'g','Quantidade de BASE-03 usada na preparação não informada.'],['Creme de leite',null,null,'Quantidade não informada.'],['Mostarda',null,null,'Quantidade não informada.'],['Muçarela',null,null,'Quantidade não informada na base; relação com a montagem não está clara.'],
  ]},
  { id:'course-prep-fricasse',code:'PEND-FRIC',type:'preparation',name:'Fricassê de frango — receita intermediária pendente',status:'draft',yield:null,yieldUnit:'g',method:'O material descreve frango finalizado com creme de leite e mostarda, sem proporções ou procedimento completo.',pending:'Receita da base e rendimento não informados. Não acrescentar milho, ausente nos materiais do curso.',items:[
    ['Frango',null,null,'Quantidade não informada.'],['Creme de leite',null,null,'Quantidade não informada.'],['Mostarda',null,null,'Quantidade não informada.'],
  ]},
  { id:'course-prod-01',code:'PROD-01',type:'product',name:'Batata de frango cremoso',status:'incomplete',productId:'p-br001',yield:1,yieldUnit:'un',packagingCapacity:500,packagingCapacityUnit:'ml',method:'Moldar a batata no fundo e laterais; espalhar 15 g de requeijão. Colocar 75 g de frango, 25 g de muçarela e mais 75 g de frango. Finalizar com 25 g de muçarela e 50 g de requeijão, com cebolinha se utilizada.',pending:'Cebolinha opcional, sem gramagem. O peso calculado quantificado é 515 g, sem embalagem e cebolinha. A cumbuca tem capacidade de 500 ml; não representa peso de 500 g.',items:[
    ['Batata amassada',250,'g','', 'course-base-01'],['Frango cremoso',150,'g','', 'course-base-02'],['Muçarela',50,'g',''],['Requeijão cremoso',65,'g',''],['Cebolinha',null,null,'Opcional; quantidade não informada.'],['Cumbuca térmica 500 ml',1,'un','Material de venda separado dos ingredientes; vincular embalagem e custo cadastrados.',null,true],
  ]},
  { id:'course-prod-02',code:'PROD-02',type:'product',name:'Batata de iscas aos quatro queijos',status:'incomplete',yield:1,yieldUnit:'un',packagingCapacity:500,packagingCapacityUnit:'ml',method:'Moldar a batata e espalhar 25 g do molho de cheddar. Adicionar 75 g de iscas, 25 g de muçarela e 15 g de requeijão; depois, mais 75 g de iscas. Finalizar com 15 g de muçarela, 15 g de cheddar, 25 g de requeijão, 5 g de parmesão e orégano.',pending:'O cheddar de 15 g da finalização é distinto do molho de cheddar da base e precisa de insumo confirmado. Orégano sem gramagem. Peso quantificado: 525 g, sem embalagem e orégano. Cumbuca 500 ml não significa 500 g.',items:[
    ['Batata amassada',250,'g','', 'course-base-01'],['Iscas ao molho',150,'g','', 'course-base-03'],['Molho de cheddar',25,'g','', 'course-base-06'],['Cheddar da finalização — insumo a confirmar',15,'g','Confirmar o insumo; não presumir que é a mesma preparação do molho.'],['Muçarela',40,'g',''],['Requeijão cremoso',40,'g',''],['Parmesão',5,'g',''],['Orégano',null,null,'Quantidade não informada.'],['Cumbuca térmica 500 ml',1,'un','Material de venda separado dos ingredientes; vincular embalagem e custo cadastrados.',null,true],
  ]},
  { id:'course-prod-03',code:'PROD-03',type:'product',name:'Batata de strogonoff de carne',status:'draft',yield:1,yieldUnit:'un',packagingCapacity:500,packagingCapacityUnit:'ml',method:'Moldar batata e espalhar 15 g de requeijão. Adicionar 150 g de strogonoff e 25 g de muçarela. Finalizar com 25 g de muçarela e 30 g de requeijão, com cebolinha se utilizada.',pending:'A preparação intermediária do strogonoff não foi quantificada e seu rendimento é desconhecido. Os 150 g são de strogonoff pronto, não de iscas mais creme. Cebolinha opcional sem gramagem. Peso quantificado da montagem: 495 g, sem embalagem e cebolinha.',items:[
    ['Batata amassada',250,'g','', 'course-base-01'],['Strogonoff pronto',150,'g','', 'course-prep-stroganoff'],['Muçarela',50,'g',''],['Requeijão cremoso',45,'g',''],['Cebolinha',null,null,'Opcional; quantidade não informada.'],['Cumbuca térmica 500 ml',1,'un','Material de venda separado dos ingredientes; vincular embalagem e custo cadastrados.',null,true],
  ]},
  { id:'course-prod-04',code:'PROD-04',type:'product',name:'Batata de frango com bacon',status:'draft',yield:1,yieldUnit:'un',pending:'Composição informada sem gramagens de montagem.',items:[['Batata',null,null,'Gramagem de montagem não informada.'],['Frango cremoso',null,null,'Gramagem de montagem não informada.','course-base-02'],['Requeijão cremoso',null,null,'Gramagem de montagem não informada.'],['Bacon dourado',null,null,'Gramagem de montagem não informada.','course-base-05'],['Muçarela',null,null,'Gramagem de montagem não informada.']]},
  { id:'course-prod-05',code:'PROD-05',type:'product',name:'Batata de fricassê',status:'draft',yield:1,yieldUnit:'un',pending:'Base de fricassê e gramagens de montagem não informadas.',items:[['Batata',null,null,'Gramagem de montagem não informada.'],['Fricassê de frango',null,null,'Base e gramagem pendentes.','course-prep-fricasse'],['Requeijão cremoso',null,null,'Gramagem de montagem não informada.'],['Muçarela',null,null,'Gramagem de montagem não informada.']]},
  { id:'course-prod-06',code:'PROD-06',type:'product',name:'Batata de fricassê com bacon',status:'draft',yield:1,yieldUnit:'un',pending:'Base de fricassê e gramagens de montagem não informadas.',items:[['Batata',null,null,'Gramagem de montagem não informada.'],['Fricassê de frango',null,null,'Base e gramagem pendentes.','course-prep-fricasse'],['Bacon dourado',null,null,'Gramagem de montagem não informada.','course-base-05'],['Requeijão cremoso',null,null,'Gramagem de montagem não informada.'],['Muçarela',null,null,'Gramagem de montagem não informada.']]},
  { id:'course-prod-07',code:'PROD-07',type:'product',name:'Batata de iscas de carne',status:'draft',yield:1,yieldUnit:'un',pending:'Gramagens de montagem não informadas.',items:[['Batata',null,null,'Gramagem de montagem não informada.'],['Iscas ao molho',null,null,'Gramagem de montagem não informada.','course-base-03'],['Muçarela',null,null,'Gramagem de montagem não informada.'],['Requeijão cremoso',null,null,'Gramagem de montagem não informada.']]},
  { id:'course-prod-08',code:'PROD-08',type:'product',name:'Batata de calabresa',status:'draft',yield:1,yieldUnit:'un',pending:'Gramagens de montagem não informadas.',items:[['Batata',null,null,'Gramagem de montagem não informada.'],['Calabresa ao molho',null,null,'Gramagem de montagem não informada.','course-base-04'],['Requeijão cremoso',null,null,'Gramagem de montagem não informada.'],['Muçarela',null,null,'Gramagem de montagem não informada.']]},
  { id:'course-prod-09',code:'PROD-09',type:'product',name:'Batata de calabresa com cheddar',status:'draft',yield:1,yieldUnit:'un',pending:'Gramagens de montagem não informadas.',items:[['Batata',null,null,'Gramagem de montagem não informada.'],['Calabresa ao molho',null,null,'Gramagem de montagem não informada.','course-base-04'],['Molho de cheddar',null,null,'Gramagem de montagem não informada.','course-base-06']]},
  { id:'course-prod-10',code:'PROD-10',type:'product',name:'Batata Calabacon',status:'draft',yield:1,yieldUnit:'un',pending:'Gramagens de montagem não informadas.',items:[['Batata',null,null,'Gramagem de montagem não informada.'],['Calabresa ao molho',null,null,'Gramagem de montagem não informada.','course-base-04'],['Bacon dourado',null,null,'Gramagem de montagem não informada.','course-base-05'],['Requeijão cremoso',null,null,'Gramagem de montagem não informada.'],['Muçarela',null,null,'Gramagem de montagem não informada.']]},
  { id:'course-prod-11',code:'PROD-11',type:'product',name:'Batata de bacon',status:'draft',yield:1,yieldUnit:'un',pending:'Gramagens de montagem não informadas.',items:[['Batata',null,null,'Gramagem de montagem não informada.'],['Bacon dourado',null,null,'Gramagem de montagem não informada.','course-base-05'],['Requeijão cremoso',null,null,'Gramagem de montagem não informada.'],['Muçarela',null,null,'Gramagem de montagem não informada.']]},
];

export async function seedCoursePotatoRecipes(client) {
  for (const recipe of COURSE_POTATO_RECIPES) {
    await client.query(`
      INSERT INTO recipe_cards
        (id,code,recipe_type,name,product_id,status,output_yield,output_unit,packaging_capacity,packaging_capacity_unit,preparation_method,pending_notes)
      VALUES ($1,$2,$3,$4,CASE WHEN $5::text IS NULL THEN NULL ELSE (SELECT id FROM products WHERE id=$5) END,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (code) DO UPDATE SET product_id=COALESCE(recipe_cards.product_id,EXCLUDED.product_id)
    `,[recipe.id,recipe.code,recipe.type,recipe.name,recipe.productId||null,recipe.status,recipe.yield??null,recipe.yieldUnit||null,
      recipe.packagingCapacity??null,recipe.packagingCapacityUnit||null,recipe.method||'',recipe.pending||'']);
  }
  for (const recipe of COURSE_POTATO_RECIPES) {
    const exists = await client.query('SELECT 1 FROM recipe_card_items WHERE recipe_id=$1 LIMIT 1',[recipe.id]);
    if (exists.rowCount) continue;
    let sort=0;
    for (const row of recipe.items||[]) {
      const [itemName,quantity,unit,pendingNote='',preparationId=null,isPackaging=false]=row;
      const itemId=`${recipe.id}-item-${++sort}`;
      await client.query(`
        INSERT INTO recipe_card_items
          (id,recipe_id,sort_order,item_name,ingredient_id,preparation_id,quantity,unit,is_packaging,pending_note)
        VALUES ($1,$2,$3,$4,
          CASE WHEN $5::text IS NULL AND (SELECT count(*) FROM ingredients WHERE lower(name)=lower($4))=1
            THEN (SELECT id FROM ingredients WHERE lower(name)=lower($4)) ELSE NULL END,
          (SELECT id FROM recipe_cards WHERE id=$5),$6,$7,$8,
          CASE WHEN (SELECT count(*) FROM ingredients WHERE lower(name)=lower($4))<>1 AND $5::text IS NULL AND NOT $8
            THEN concat_ws(' ',NULLIF($9,''),'Vínculo ao ingrediente canônico pendente; correspondência exata ausente ou ambígua.')
            ELSE $9 END)
        ON CONFLICT (id) DO NOTHING
      `,[itemId,recipe.id,sort,itemName,preparationId,quantity??null,unit||null,isPackaging,pendingNote]);
    }
  }
}

export function calculateRecipeCardCosts(cards) {
  const byId=new Map(cards.map(card=>[card.id,card]));
  const memo=new Map();
  function cost(card,stack=new Set()) {
    if(memo.has(card.id))return memo.get(card.id);
    if(stack.has(card.id))return {total:null,unit:null,complete:false,notes:['Ciclo entre preparações.']};
    const next=new Set(stack).add(card.id); let total=0,complete=true; const notes=[];
    for(const item of card.items){
      if(item.isPackaging&&!item.ingredientId){complete=false;notes.push(item.pendingNote||`${item.itemName}: embalagem ou custo pendente.`);continue;}
      if(item.quantity===null){complete=false;notes.push(item.pendingNote||`${item.itemName}: quantidade pendente.`);continue;}
      let unitCost=null;
      if(item.preparationId){const prep=byId.get(item.preparationId);if(prep){const nested=cost(prep,next);unitCost=nested.unit;if(!nested.complete)notes.push(...nested.notes.map(n=>`${prep.name}: ${n}`));}}
      else if(item.ingredientId){const ingredient=card.ingredientsById.get(item.ingredientId); if(ingredient){
        const factors={g:{g:1,kg:.001},kg:{g:1000,kg:1},ml:{ml:1,L:.001},L:{ml:1000,L:1}};
        const factor=item.unit===ingredient.unit?1:factors[item.unit]?.[ingredient.unit];
        if(factor!==undefined && Number(ingredient.unitCost)>0)unitCost=Number(ingredient.unitCost)*factor;
      }}
      if(unitCost===null){complete=false;notes.push(item.pendingNote||`${item.itemName}: custo ou unidade incompatível pendente.`);continue;}
      total += Number(item.quantity)*unitCost;
    }
    if(card.recipeType==='preparation' && !(Number(card.outputYield)>0)){complete=false;notes.push('Rendimento pronto ainda não pesado.');}
    if(card.status!=='ready'){complete=false;notes.push('Ficha em rascunho ou incompleta; validar antes de considerar custo final.');}
    const result={total:complete?total:null,partialTotal:total,unit:card.recipeType==='preparation'&&Number(card.outputYield)>0&&complete?total/Number(card.outputYield):null,complete,notes:[...new Set(notes)]};
    memo.set(card.id,result);return result;
  }
  return cards.map(card=>({...card,cost:cost(card)}));
}
