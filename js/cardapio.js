const Cardapio = {
  storefront: null, reorderShortcuts: [], reorderChecked: false,
  apiActive: false, products: [], promotions: [], cart: new Map(), productOptions: new Map(), flavoredIce: new Map(), combos: new Map(), pendingCustomization: null, pendingCombo: null, pendingComboCounts: new Map(), category: 'Todos', search: '', deliveryFee: 0, coupon: null, quote: null, quoteError: null, quoteSequence: 0, quoteBusy: false, tableNumber: '', refreshPromise: null, submitting: false,
  normalizePostalCode(value){return String(value||'').replace(/\D/g,'').slice(0,8)},
  deliveryForPostalCode(value){const postalCode=this.normalizePostalCode(value),zones=this.storefront?.deliveryZones?.zones||[];const zone=zones
    .filter(item=>String(item?.prefixo||'').replace(/\D/g,'')&&postalCode.startsWith(String(item.prefixo).replace(/\D/g,'')))
    .sort((a,b)=>String(b.prefixo).length-String(a.prefixo).length)[0];if(!zone)return null;const fee=Number(zone.valor);return Number.isFinite(fee)&&fee>=0?{fee,zone:String(zone.nome||zone.prefixo)}:null},
  money(value){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value)},
  escape(value){const el=document.createElement('div');el.textContent=String(value??'');return el.innerHTML},
  image(url){if(!url)return './assets/products/snacks.jpg';return url.replace(/^\.\.\//,'./')},
  endpoint(path){
    const apiOrigin=location.hostname.endsWith('github.io') ? 'https://177-153-67-250.nip.io' : '';
    return apiOrigin ? `${apiOrigin.replace(/\/$/,'')}/api/v1${path}` : new URL(`./api/v1${path}`,location.href).href;
  },
  async fetchPublic(path){
    const response=await fetch(this.endpoint(path),{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error(`http_${response.status}`);
    return (await response.json()).data;
  },
  async refresh(){
    if(this.refreshPromise)return this.refreshPromise;
    this.refreshPromise=(async()=>{
      try{
        const [storefront,products,promotions]=await Promise.all([this.fetchPublic('/public/storefront'),this.fetchPublic('/public/catalog'),this.fetchPublic('/public/promotions')]);
        if(!storefront||!Array.isArray(products)||!Array.isArray(promotions))throw new Error('invalid_catalog');
        const previous=new Map(this.products.map(p=>[p.id,JSON.stringify([p.name,p.category,p.description,p.sale_price,p.photo_url,p.current_stock,p.option_prices])]));const previousPromotions=JSON.stringify(this.promotions);
        this.storefront=storefront;
        this.products=products;
        this.promotions=promotions;
        this.apiActive=true;
        if([...this.cart.keys()].some(key=>!products.some(p=>p.id===this.cartProductId(key)))){
          for(const key of this.cart.keys())if(!products.some(p=>p.id===this.cartProductId(key))){this.cart.delete(key);this.productOptions.delete(key);this.flavoredIce.delete(key)}
          this.toast('Produto indisponível removido do carrinho.');
        }
        for(const [instanceId,combo] of this.combos){const current=promotions.find(promotion=>promotion.id===combo.promotion.id);if(!current){this.combos.delete(instanceId);this.toast('Um combo saiu do cardápio e foi removido do carrinho.')}else combo.promotion=current;}
        if(this.pendingCombo&&previousPromotions!==JSON.stringify(promotions)){this.closeCustomization();this.toast('A promoção foi atualizada. Monte o combo novamente com a regra atual.');}
        if(this.pendingCustomization&&!products.some(p=>p.id===this.pendingCustomization.product.id))this.closeCustomization();
        if(this.coupon&&(products.some(p=>previous.get(p.id)!==JSON.stringify([p.name,p.category,p.description,p.sale_price,p.photo_url,p.current_stock,p.option_prices]))||previousPromotions!==JSON.stringify(promotions)))this.coupon=null;
        this.renderStorefront();
        this.renderPromotions();
        this.renderFeatured();
        const notice=document.getElementById('service-notice');
        const testMode=storefront.allowOrdersWithoutStockForTesting===true;
        const closedOutsideHours=!storefront.isOpen&&storefront.closedReason==='outside_hours';
        notice.classList.toggle('hidden',!this.tableNumber&&!testMode&&!closedOutsideHours);
        if(testMode)notice.textContent=`MODO DE TESTES — itens liberados sem estoque real. Pedidos serão registrados como teste e dependem de confirmação.${this.tableNumber?` Mesa ${this.tableNumber}.`:''}`;
        else if(closedOutsideHours)notice.textContent=`Estamos fora do horário de atendimento (${storefront.hours}). O cardápio aceita pedidos somente nesse horário.`;
        else if(this.tableNumber)notice.textContent=`Pedido para consumo na Mesa ${this.tableNumber}.`;
      }catch{
        this.apiActive=false;
        this.products=[];
        this.promotions=[];this.combos.clear();this.quote=null;
        this.storefront=null;
        this.coupon=null;
        this.openCart(false);
        if(this.pendingCustomization)this.closeCustomization();
        const notice=document.getElementById('service-notice');
        notice.classList.remove('hidden');
        notice.textContent='Cardápio temporariamente indisponível. Não é possível fazer pedidos até a conexão com o ERP voltar.';
        const status=document.getElementById('store-status');
        status.classList.remove('open');status.classList.add('closed');status.querySelector('strong').textContent='Cardápio indisponível';
        for(const id of ['minimum-order','delivery-time','payment-summary','opening-hours'])document.getElementById(id).textContent='Indisponível';
      }
      this.renderCategories();this.renderFeatured();this.renderCatalog();this.decoratePromotionPrices();this.renderCart();this.loadReorderShortcuts();if((this.cart.size||this.combos.size)&&typeof document.querySelector==='function')this.refreshQuote();
    })().finally(()=>{this.refreshPromise=null});
    return this.refreshPromise;
  },
  renderStorefront(){
    const data=this.storefront||{};
    const minimum=document.getElementById('minimum-order');if(minimum)minimum.textContent=this.money(Number(data.minimumOrder ?? 20));
    const delivery=document.getElementById('delivery-time');if(delivery)delivery.textContent=data.deliveryTime||'30–60 min';
    const payments=Array.isArray(data.paymentMethods)&&data.paymentMethods.length?data.paymentMethods:['Pix','Dinheiro','Cartão na entrega'];
    const paymentSummary=document.getElementById('payment-summary');if(paymentSummary)paymentSummary.textContent=payments.join(', ');
    const hours=document.getElementById('opening-hours');if(hours)hours.textContent=data.hours||'Horários definidos no ERP';
    const status=document.getElementById('store-status');if(status){status.classList.toggle('open',Boolean(data.isOpen));status.classList.toggle('closed',!data.isOpen);status.querySelector('strong').textContent=data.isOpen?'Aberto agora':data.closedReason==='outside_hours'?'Fora do horário':'Fechado agora'}
    const promotion=(Array.isArray(data.promotions)&&data.promotions[0])||{};const promotionText=document.getElementById('promotion-text');if(promotionText)promotionText.textContent=promotion.description||'Confira as promoções disponíveis no cardápio.';
    const whatsapp=document.querySelector('#store-panel-contato a');if(whatsapp&&data.whatsapp)whatsapp.href=`https://wa.me/${String(data.whatsapp).replace(/\D/g,'')}`;
    const deliveryInfo=document.getElementById('delivery-info');if(deliveryInfo){const zones=Array.isArray(data.deliveryZones?.zones)?data.deliveryZones.zones:[];const fees=[...new Set(zones.map(zone=>Number(zone.valor)).filter(fee=>Number.isFinite(fee)))];const feeText=fees.length?fees.map(fee=>this.money(fee)).join(' a '):'confirmada pelo estabelecimento';deliveryInfo.textContent=`Entrega por CEP: ${zones.length?'área atendida conforme CEP cadastrado':'consulte o estabelecimento'} · taxa de ${feeText}. Retirada no local disponível mediante confirmação.`}
    const select=document.querySelector('[name="payment"]');if(select){const selected=select.value;select.innerHTML=payments.map(method=>`<option>${this.escape(method)}</option>`).join('');if(payments.includes(selected))select.value=selected}
  },
  renderPromotions(){
    const el=document.getElementById('combo-catalog');if(!el)return;
    const available=this.promotions.filter(p=>p.rule_type==='combo'&&(p.combo_price!=null||p.discount_percent!=null)&&p.groups?.length);
    const discounts=this.promotions.filter(p=>p.rule_type==='percentage'&&Number(p.discount_percent)>0&&Array.isArray(p.products));
    const discountCards=discounts.flatMap(p=>(p.products||[]).map(product=>{const normal=Number(product.salePrice),discount=Number(p.discount_percent),final=normal*(1-discount/100);if(!Number.isFinite(normal)||!Number.isFinite(final))return '';const catalogProduct=this.products.find(item=>item.id===product.id),photo=catalogProduct?.photo_url?this.image(catalogProduct.photo_url):'./assets/products/snacks.jpg';return `<article class="promo-card"><img class="promo-image" src="${this.escape(photo)}" alt="${this.escape(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='./assets/products/snacks.jpg'"><div class="promo-card-top"><span class="product-category">OFERTA</span><em class="promo-ribbon">-${discount}%</em></div><h2>${this.escape(product.name)}</h2><p>${this.escape(p.description||'Oferta especial por tempo limitado.')}</p><div class="promo-price"><del>${this.money(normal)}</del><strong>${this.money(final)}</strong></div><button type="button" data-promo-add="${this.escape(product.id)}">Escolher produto</button></article>`})).join('');
    if(!available.length&&!discountCards){el.classList.add('hidden');el.innerHTML='';return}
    el.classList.remove('hidden');el.innerHTML=`<div class="promotion-heading"><span class="product-category">OFERTAS E COMBOS</span><strong>Escolha uma oferta para aproveitar</strong></div>${discountCards}${available.map(p=>{
      const selected=[...this.combos.values()].filter(combo=>combo.promotion.id===p.id).length,groups=(p.groups||[]).map(group=>`${group.requiredQuantity} ${this.escape(group.name.toLowerCase())}`).join(' + ');
      const comboImages={
        'COMBO-BATATA-RECHEADA':['./assets/promotions/combo-duas-batatas-refrigerante.jpg','Duas batatas recheadas em cumbucas com refrigerante'],
        'COMBO-CAIPIRINHA-DOBRO':['./assets/promotions/combo-caipirinha-dobro.jpg','Duas caipirinhas com limão, gelo e morango'],
        'COMBO-DUPLA-CERVEJAS':['./assets/promotions/combo-dupla-cervejas.jpg','Duas cervejas geladas em copos'],
        'COMBO-PETISCO-BEBIDA':['./assets/promotions/combo-petisco-bebida.jpg','Petiscos variados acompanhados de refrigerante e água'],
      };
      const visual=comboImages[p.code];
      const image=visual?`<img class="combo-image" src="${visual[0]}" alt="${visual[1]}" loading="lazy">`:'';
      const priceLabel=p.discount_percent!=null?'Desconto aplicado nos itens escolhidos':`A partir de ${this.money(Number(p.combo_price))}`;
      const description=String(p.description||groups).replace(/Skol[^.]*\.?/gi,'').replace(/\s{2,}/g,' ').trim();
      return `<article class="combo-card">${image}<span class="product-category">COMBO</span><h2>${this.escape(p.name)}</h2><p>${this.escape(description)}</p><p>${groups}</p><strong>${priceLabel}</strong><button type="button" data-combo-add="${this.escape(p.id)}">${selected?`Adicionar outro · ${selected} no carrinho`:'Montar combo'}</button></article>`;
    }).join('')}`;
  },
  categoryOrder: ['Batatas Recheadas','Petiscos','Açaí','Drinks','Cervejas','Bebidas','Conveniência'],
  featuredProducts(){return [...this.products].filter(product=>product?.active!==false&&Number.isFinite(Number(product.sale_price))).sort((a,b)=>Number(b.sale_price)-Number(a.sale_price)||String(a.name).localeCompare(String(b.name),'pt-BR')).slice(0,5)},
  commercialDescriptions:{
    'p-br003':'Batata recheada super cremosa com bacon crocante, cheddar cremoso e muçarela gratinada. Aproximadamente 500g.',
    'p-1791993059031-k0nv2':'Batata recheada super cremosa com calabresa ao molho de tomate, bacon dourado, requeijão cremoso e muçarela. Aproximadamente 500g.',
    'p-1791993066975-p7bs7':'Batata recheada super cremosa com bacon crocante, requeijão cremoso e muçarela gratinada. Aproximadamente 500g.',
    'p-br002':'Batata recheada super cremosa com calabresa acebolada, requeijão cremoso e muçarela gratinada. Aproximadamente 500g.',
    'p-1791993051969-f6ivs':'Batata recheada super cremosa com calabresa ao molho de tomate e uma cobertura irresistível de cheddar cremoso. Aproximadamente 500g.',
    'p-br005':'Batata recheada super cremosa com carne seca desfiada, requeijão cremoso e muçarela gratinada. Aproximadamente 500g.',
    'p-1791993022656-han1o':'Batata recheada super cremosa com frango temperado, bacon crocante, requeijão cremoso e muçarela. Aproximadamente 500g.',
    'p-br001':'Batata recheada super cremosa com frango temperado, requeijão cremoso e muçarela gratinada. Aproximadamente 500g.',
    'p-1791993030826-jfj9a':'Batata recheada super cremosa com strogonoff de frango, requeijão cremoso e muçarela gratinada. Aproximadamente 500g.',
    'p-1791993037917-ciry9':'Batata recheada super cremosa com strogonoff de frango, bacon crocante, requeijão cremoso e muçarela. Aproximadamente 500g.',
    'p-1791993003813-xnkj7':'Batata recheada super cremosa com iscas de carne ao molho, cheddar cremoso, muçarela, requeijão e parmesão. Aproximadamente 500g.',
    'p-1791993044967-fl6uf':'Batata recheada super cremosa com iscas de carne ao molho, muçarela gratinada e requeijão cremoso. Aproximadamente 500g.',
    'p-1791993015540-7arr9':'Batata recheada super cremosa com strogonoff de carne, muçarela gratinada e requeijão cremoso. Aproximadamente 500g.',
    'p-br004':'Batata recheada super cremosa com strogonoff de frango, muçarela gratinada e batata palha crocante. Aproximadamente 500g.',
    'p-pet002':'Porção generosa de batata frita crocante, coberta com cheddar cremoso e bacon dourado. Escolha P (aprox. 400g) ou G (aprox. 700g).',
    'p-pet001':'Batata frita sequinha, dourada e crocante, perfeita para compartilhar. Escolha P (aprox. 300g) ou G (aprox. 500g).',
    'p-pet003':'Porção generosa de calabresa douradinha e acebolada, cheia de sabor para compartilhar. Aproximadamente 500g.',
    'p-pet004':'Frango a passarinho bem temperado, dourado e frito na hora, perfeito para petiscar. Aproximadamente 500g.',
    'p-pet005':'Iscas de carne macias, douradas e cheias de sabor, ideais para compartilhar. Aproximadamente 500g.',
    'p-aca001':'Açaí cremoso batido na hora e servido bem gelado em garrafinha de 300ml. Escolha seu sabor e deixe ainda mais gostoso com complementos.'
  },
  displayDescription(product){const custom=this.commercialDescriptions[product?.id];if(custom)return custom;return String(product?.description||'').replace(/purê de batata cremoso|purê de batata|batata amassada|batatas amassadas/gi,'batata cremosa').replace(/\s+/g,' ').replace(/\s+([,.])/g,'$1').trim()},
  editorialLabel(product){const category=String(product?.category||'').trim().toLocaleUpperCase('pt-BR');return category==='AÇAÍ'?'NOVIDADE':category==='BATATAS RECHEADAS'?'FAVORITO':'Destaque'},
  productPromotion(product){const promotion=this.promotions.find(item=>item.active&&item.rule_type==='percentage'&&Number(item.discount_percent)>0&&item.products?.some(candidate=>candidate.id===product?.id));if(!promotion)return null;const normal=Number(product.sale_price),discount=Number(promotion.discount_percent),final=normal*(1-discount/100);return Number.isFinite(normal)&&Number.isFinite(final)?{discount,normal,final}:null},
  productNotice(product){const description=this.displayDescription(product),category=String(product?.category||'').trim().toLocaleUpperCase('pt-BR');if(/leite|requeijão|muçarela|cheddar|parmesão|queijo/i.test(description)||category==='BATATAS RECHEADAS'||category==='AÇAÍ')return'Pode conter leite e derivados. Consulte o estabelecimento sobre alergênicos.';if(['DRINKS','CERVEJAS'].includes(category))return'Bebida alcoólica. Venda proibida para menores de 18 anos.';return''},
  renderFeatured(){const element=document.getElementById('featured-catalog');if(!element)return;const products=this.featuredProducts();if(!products.length){element.classList.add('hidden');element.innerHTML='';return}element.classList.remove('hidden');element.innerHTML=`<div class="section-heading"><div><span class="product-category">DESTAQUES</span><h2>Sabores para começar</h2></div><span>Escolhas especiais do Petisbar</span></div><div class="featured-grid">${products.map(product=>{const unavailable=this.stockLimit(product)<=0;return `<article class="featured-card"><img src="${this.escape(this.image(product.photo_url))}" alt="${this.escape(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='./assets/products/snacks.jpg'"><div><em class="product-badge">${this.editorialLabel(product)}</em><strong>${this.escape(product.name)}</strong><small>${this.escape(this.displayDescription(product))}</small><span>${unavailable?'Indisponível':this.money(Number(product.sale_price))}</span><button type="button" data-featured-add="${this.escape(product.id)}" ${unavailable?'disabled':''}>${unavailable?'Indisponível':'Adicionar'}</button></div></article>`}).join('')}</div>`},
  async loadReorderShortcuts(){if(this.reorderChecked||!this.apiActive)return;this.reorderChecked=true;try{const response=await fetch(this.endpoint('/customer/reorder-shortcuts'),{headers:{Accept:'application/json'},credentials:'include',cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok)return;const body=await response.json();this.reorderShortcuts=body.data||[];const element=document.getElementById('reorder-shortcuts');if(!element||!this.reorderShortcuts.length)return;element.classList.remove('hidden');element.innerHTML=this.reorderShortcuts.map(order=>{const count=(order.items||[]).reduce((sum,item)=>sum+Number(item.quantity||1),0);return `<article class="reorder-card"><strong>Pedido #${this.escape(order.orderNumber)}</strong><span>${count} item(ns) · ${this.money(Number(order.total))}</span><button type="button" data-reorder="${this.escape(order.id)}">Pedir novamente</button></article>`}).join('')}catch{}},
  reorderOptions(options={}){return Object.fromEntries(Object.entries(options||{}).filter(([key])=>!key.startsWith('_')))},
  addReorderItem(item){const productId=item.productId||item.product_id,product=this.products.find(p=>p.id===productId);if(!product)return;const options=this.reorderOptions(item.options),key=this.cartKey(productId,options),current=this.cart.get(key)||0,limit=this.stockLimit(product),next=Math.min(limit,this.qty(productId)+Number(item.quantity||1));if(next>current){this.cart.set(key,current+next-this.qty(productId));this.productOptions.set(key,options)}},
  reorderOrder(id){const order=this.reorderShortcuts.find(item=>item.id===id);if(!order)return;const comboPromotions=(order.promotions||[]).filter(item=>item.rule_type==='combo');const comboApplicationIds=new Set(comboPromotions.map(item=>item.id));for(const item of order.items||[])if(!item.promotion_application_id||!comboApplicationIds.has(item.promotion_application_id))this.addReorderItem(item);for(const application of comboPromotions){const promotion=this.promotions.find(item=>item.id===application.promotion_id),snapshot=Array.isArray(application.item_snapshot)?application.item_snapshot:[];if(!promotion){for(const item of order.items||[])if(item.promotion_application_id===application.id)this.addReorderItem(item);continue}const grouped=new Map();for(const selected of snapshot){const key=selected.groupId;const list=grouped.get(key)||[];const options=this.reorderOptions(selected.options);const existing=list.find(item=>item.productId===selected.productId&&JSON.stringify(item.options||{})===JSON.stringify(options));if(existing)existing.quantity++;else list.push({productId:selected.productId,quantity:1,options});grouped.set(key,list)}const selections=[...grouped].map(([groupId,items])=>({groupId,items}));if(this.validComboSelections(promotion,selections))this.combos.set(crypto.randomUUID(),{promotion,selections});else for(const group of selections)for(const item of group.items)this.addReorderItem(item)}if(this.coupon)this.clearCoupon('Carrinho alterado. Aplique o cupom novamente.');this.renderCart();this.renderPromotions();this.refreshQuote();document.getElementById('cart-fab').click()},
  categoryLabel(category, product=null){const raw=String(category||'').trim();const name=String(product?.name||'').toLocaleLowerCase('pt-BR');if(raw.toLocaleUpperCase('pt-BR')==='BATATAS RECHEADAS'||name==='batata com cheddar e bacon')return'Batatas Recheadas';return ['Refrigerantes','Águas','Energéticos'].includes(raw)?`Bebidas · ${raw}`:raw},
  validComboSelections(promotion,selections){if(!promotion||!Array.isArray(selections)||selections.length!==promotion.groups.length)return false;return promotion.groups.every(group=>{const selection=selections.find(item=>item.groupId===group.id);if(!selection)return false;const items=selection.items||[],count=items.reduce((sum,item)=>sum+Number(item.quantity||1),0);return count>=group.requiredQuantity&&count<=group.maxQuantity&&(group.allowSameProduct||new Set(items.map(item=>item.productId)).size===count)&&items.every(item=>group.products.some(product=>product.id===item.productId&&product.active&&this.products.some(current=>current.id===item.productId)))});},
  categoryMatches(product, category){return category==='Todos'||this.categoryLabel(product.category,product)===category||category==='Bebidas'&&this.categoryLabel(product.category,product).startsWith('Bebidas ·')},
  async init(){
    this.tableNumber=(new URLSearchParams(location.search).get('mesa')||'').trim().slice(0,20);
    this.bind();
    if(this.tableNumber){const pickup=document.querySelector('[name="fulfillment"][value="retirada"]');if(pickup)pickup.checked=true;document.querySelectorAll('[name="fulfillment"]').forEach(input=>input.disabled=true)}
    await this.refresh();
    const reorder=localStorage.getItem('petisbar.reorderItems'),reorderCombos=localStorage.getItem('petisbar.reorderCombos');
    if(reorder||reorderCombos){try{for(const item of JSON.parse(reorder||'[]'))this.addReorderItem(item);for(const combo of JSON.parse(reorderCombos||'[]')){const promotion=this.promotions.find(item=>item.id===combo.promotionId);if(promotion&&this.validComboSelections(promotion,combo.selections))this.combos.set(crypto.randomUUID(),{promotion,selections:combo.selections});else for(const group of combo.selections||[])for(const item of group.items||[])this.addReorderItem(item)}}catch{}localStorage.removeItem('petisbar.reorderItems');localStorage.removeItem('petisbar.reorderCombos');this.renderCart();if(this.cart.size||this.combos.size)this.refreshQuote()}
    setInterval(()=>{if(!document.hidden)this.refresh()},15000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.refresh()});
    window.addEventListener('focus',()=>this.refresh());
  },
  bind(){
    document.getElementById('reorder-shortcuts').addEventListener('click',event=>{const button=event.target.closest('[data-reorder]');if(button)this.reorderOrder(button.dataset.reorder)});
    document.querySelectorAll('[data-store-tab]').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('[data-store-tab]').forEach(item=>item.classList.toggle('active',item===tab));document.querySelectorAll('.store-panel').forEach(panel=>panel.classList.toggle('hidden',panel.id!==`store-panel-${tab.dataset.storeTab}`))}));
    document.getElementById('catalog-search').addEventListener('input',e=>{this.search=e.target.value.toLowerCase();this.renderCatalog()});
    document.getElementById('category-list').addEventListener('click',e=>{const button=e.target.closest('[data-category]');if(!button)return;this.category=button.dataset.category;this.renderCategories();this.renderCatalog()});
    document.getElementById('catalog').addEventListener('click',e=>{if(e.target.closest('[data-retry]')){this.refresh();return}const button=e.target.closest('[data-action]');if(button){if(button.dataset.action==='inc')this.beginAdd(button.dataset.id);else this.change(button.dataset.id,-1)}});
    document.getElementById('combo-catalog').addEventListener('click',e=>{const promoButton=e.target.closest('[data-promo-add]');if(promoButton){this.beginAdd(promoButton.dataset.promoAdd);return}const button=e.target.closest('[data-combo-add]');if(button){const promotion=this.promotions.find(item=>item.id===button.dataset.comboAdd);if(promotion)this.beginCombo(promotion);}});
    document.getElementById('featured-catalog').addEventListener('click',e=>{const button=e.target.closest('[data-featured-add]');if(button)this.beginAdd(button.dataset.featuredAdd)});
    document.getElementById('customization-content').addEventListener('change',e=>{if(this.pendingCombo&&(e.target.matches('[data-combo-product]'))){this.captureComboDraft();this.renderComboCustomization();}});
    document.getElementById('customization-content').addEventListener('click',e=>{const button=e.target.closest('[data-combo-quantity]');if(!button||!this.pendingCombo)return;const group=this.pendingCombo.groups.find(item=>item.id===button.dataset.groupId);if(!group)return;this.captureComboDraft();const count=this.pendingComboCounts.get(group.id)||group.requiredQuantity;const next=Math.max(group.requiredQuantity,Math.min(group.maxQuantity,count+Number(button.dataset.comboQuantity)));this.pendingComboCounts.set(group.id,next);this.renderComboCustomization();});
    document.getElementById('catalog').addEventListener('change',e=>{if(e.target.matches('[data-flavored-ice]')){this.flavoredIce.set(e.target.dataset.flavoredIce,e.target.checked);if(this.coupon)this.clearCoupon('Opção alterada. Aplique o cupom novamente.');this.renderCart()}});
    document.getElementById('cart-items').addEventListener('click',e=>{const remove=e.target.closest('[data-combo-remove]');if(remove){this.combos.delete(remove.dataset.comboRemove);if(this.coupon)this.clearCoupon('Carrinho alterado. Aplique o cupom novamente.');this.renderCart();this.renderPromotions();this.refreshQuote();return}const button=e.target.closest('[data-action]');if(button)this.change(button.dataset.id,button.dataset.action==='inc'?1:-1)});
    document.getElementById('cart-fab').addEventListener('click',()=>this.openCart(true));document.getElementById('cart-close').addEventListener('click',()=>this.openCart(false));
    document.getElementById('cart-overlay').addEventListener('click',e=>{if(e.target.id==='cart-overlay')this.openCart(false)});
    document.querySelectorAll('[name="fulfillment"]').forEach(input=>input.addEventListener('change',()=>this.renderCheckout()));
    document.querySelector('[name="postalCode"]')?.addEventListener('input',()=>this.renderCheckout());
    document.getElementById('coupon-apply').addEventListener('click',()=>this.applyCoupon());
    document.getElementById('coupon-code').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase();if(this.coupon&&e.target.value!==this.coupon.code)this.clearCoupon('Aplique o cupom novamente.')});
    document.getElementById('checkout-form').addEventListener('submit',e=>this.submit(e));
    document.getElementById('customization-close').addEventListener('click',()=>this.closeCustomization());
    document.getElementById('customization-cancel').addEventListener('click',()=>this.closeCustomization());
    document.getElementById('customization-add').addEventListener('click',()=>this.confirmCustomization());
    document.getElementById('customization-overlay').addEventListener('click',e=>{if(e.target.id==='customization-overlay')this.closeCustomization()});
  },
  customizationConfig(product){
    if(Array.isArray(product?.option_groups)&&product.option_groups.length)return {groups:product.option_groups.map(group=>({...group,options:group.options.map(option=>{
      const linked=option.priceProductId?this.products.find(item=>item.id===option.priceProductId):null,price=linked?Number(linked.sale_price):Number(option.priceProductPrice);
      const suffix=option.priceMode!=='base'&&Number.isFinite(price)?` (${option.priceMode==='add'?'+ ':''}${this.money(price)})`:'';
      return [option.value,`${option.label}${suffix}`];
    })}))};
    const id=product?.id;
    const flavors=[['natural','Natural'],['morango','Morango'],['maracuja','Maracujá']];
    if(id==='p-aca001')return{groups:[{key:'flavor',label:'Escolha o sabor',required:true,options:flavors},{key:'complement',label:'Escolha os complementos',type:'checkbox',options:[['leite-condensado','Leite condensado'],['leite-em-po','Leite em pó'],['granola','Granola'],['pacoca','Paçoca']]}]};
    if(id==='p-ref001'){const soda=product.option_prices?.soda||{};return{groups:[{key:'sodaFlavor',label:'Escolha o refrigerante',required:true,options:[['coca-cola','Coca-Cola 350ml'],['guarana','Guaraná Antarctica 350ml'],['sprite','Sprite 350ml']].filter(([key])=>soda[key]!=null&&Number.isFinite(Number(soda[key]))).map(([key,label])=>[key,`${label} (${this.money(Number(soda[key]))})`])}]}};
    if(id==='p-drk001'){const prices=product.option_prices?.flavors||{};return{groups:[{key:'flavor',label:'Escolha o sabor',required:true,options:[['natural','Limão'],...([['morango','Morango'],['maracuja','Maracujá']].filter(([key])=>prices[key]!=null&&Number.isFinite(Number(prices[key]))).map(([key,label])=>[key,`${label} (${this.money(Number(prices[key]))})`]))]}]}};
    if(['p-drk004','p-drk005','p-drk006'].includes(id))return{groups:[{key:'flavor',label:'Escolha o sabor',required:true,options:flavors}]};
    if(['p-drk010','p-drk011'].includes(id))return{groups:[{key:'size',label:'Escolha o tamanho',required:true,options:[['500ml','500 ml'],...(Number.isFinite(Number(product.option_prices?.['700ml']))&&product.option_prices?.['700ml']!=null?[['700ml',`700 ml (${this.money(Number(product.option_prices['700ml']))})`]]:[])]},{key:'beverage',label:'Escolha a bebida',required:true,options:[['vodka','Vodka Smirnoff'],['whisky','Whisky']]},{key:'iceFlavor',label:'Escolha o sabor do gelo',required:true,options:[['coco','Coco'],['maracuja','Maracujá']]}]};
    if(id==='p-pet002'){const price=product.option_prices||{},drinks=price.drinks||{};return{groups:[{key:'size',label:'Escolha o tamanho',required:true,options:[['P','P — 400g'],...(Number.isFinite(Number(price.G))&&price.G!=null?[['G',`G — 700g (${this.money(Number(price.G))})`]]:[])]},{key:'drink',label:'Adicionar uma bebida',options:[['none','Sem bebida'],...([['coca-cola','Coca-Cola 350ml'],['guarana','Guaraná Antarctica 350ml'],['agua','Água mineral 500ml']].filter(([key])=>drinks[key]!=null&&Number.isFinite(Number(drinks[key]))).map(([key,label])=>[key,`${label} (+ ${this.money(Number(drinks[key]))})`]))]}]}};
    if(id==='p-pet001'){const price=product.option_prices?.G;return{groups:[{key:'size',label:'Escolha o tamanho',required:true,options:[['P','P — 300g'],...(price!=null&&Number.isFinite(Number(price))?[['G',`G — 500g (${this.money(Number(price))})`]]:[])]}]}};
    return null;
  },
  beginCombo(promotion){
    if(!this.apiActive)return;
    this.pendingCombo=promotion;this.pendingCustomization=null;this.comboDraft=new Map();this.pendingComboCounts=new Map(promotion.groups.map(group=>[group.id,group.requiredQuantity]));
    this.renderComboCustomization();const overlay=document.getElementById('customization-overlay');overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
  },
  captureComboDraft(){
    if(!this.pendingCombo)return;
    const draft=new Map();
    for(const group of this.pendingCombo.groups){for(const slot of document.querySelectorAll(`[data-combo-slot][data-group-id="${group.id}"]`)){
      const index=Number(slot.dataset.slot),productId=slot.querySelector('[data-combo-product]')?.value,options={};
      for(const input of slot.querySelectorAll('[data-combo-option]:checked')){const key=input.dataset.optionKey,value=input.value;if(input.type==='checkbox'){const values=options[key]||[];values.push(value);options[key]=values}else options[key]=value}
      draft.set(`${group.id}:${index}`,{productId,options});
    }}this.comboDraft=draft;
  },
  comboOptionMarkup(product,group,slot,selected={}){
    const config=this.customizationConfig(product);if(!config)return'';
    return config.groups.map(optionGroup=>{
      const allowed=group.allowedOptions?.[optionGroup.key];let choices=optionGroup.options;
      if(Array.isArray(allowed))choices=choices.filter(([value])=>allowed.includes(value));
      if(!choices.length)return'';
      const type=optionGroup.type==='checkbox'?'checkbox':'radio',saved=selected[optionGroup.key];
      return `<fieldset class="customization-group"><legend>${this.escape(optionGroup.label)} ${optionGroup.required?'<span class="customization-required">Obrigatório</span>':''}</legend><div class="combo-extra-options">${choices.map(([value,label],index)=>{
        const checked=type==='checkbox'?(Array.isArray(saved)&&saved.includes(value)):saved?saved===value:index===0;
        const name=`combo-option-${group.id}-${slot}-${optionGroup.key}`;
        return `<label class="customization-option"><input type="${type}" name="${this.escape(name)}" data-combo-option data-option-key="${this.escape(optionGroup.key)}" value="${this.escape(value)}" ${checked?'checked':''}><span>${this.escape(label)}</span></label>`;
      }).join('')}</div></fieldset>`;
    }).join('');
  },
  renderComboCustomization(){
    const promotion=this.pendingCombo;if(!promotion)return;const draft=this.comboDraft||new Map();
    const html=promotion.groups.map(group=>{
      const count=this.pendingComboCounts.get(group.id)||group.requiredQuantity;
      const slots=Array.from({length:count},(_,index)=>{
        const saved=draft.get(`${group.id}:${index}`)||{},allowed=group.products.filter(product=>product.active&&this.products.some(p=>p.id===product.id));
        const selected=allowed.find(product=>product.id===saved.productId)||allowed[0];if(!selected)return`<p>Este grupo não possui produtos disponíveis no catálogo.</p>`;
        const selectedGroup={...group,allowedOptions:Object.fromEntries(Object.entries(group.allowedOptions||{}).map(([key,values])=>[key,selected.allowedOptions?.[key]?values.filter(value=>selected.allowedOptions[key].includes(value)):values]))};
        const options=this.comboOptionMarkup(this.products.find(p=>p.id===selected.id),selectedGroup,index,saved.options);
        return `<div class="combo-choice-slot" data-combo-slot data-group-id="${this.escape(group.id)}" data-slot="${index}"><label>Escolha ${this.escape(group.name.toLowerCase())} ${index+1}<select data-combo-product>${allowed.map(product=>`<option value="${this.escape(product.id)}" ${selected.id===product.id?'selected':''}>${this.escape(product.name)}${promotion.discount_percent!=null?` · ${this.money(Number(product.salePrice))}`:Number(product.surcharge)?` (+ ${this.money(Number(product.surcharge))})`:''}</option>`).join('')}</select></label>${options}</div>`;
      }).join('');
      return `<section class="combo-group-builder"><h3>${this.escape(group.name)} <small>${group.requiredQuantity} obrigatório(s)</small></h3>${slots}<div class="combo-group-actions">${count<group.maxQuantity?`<button type="button" data-combo-quantity="1" data-group-id="${this.escape(group.id)}">+ Adicionar unidade</button>`:''}${count>group.requiredQuantity?`<button type="button" data-combo-quantity="-1" data-group-id="${this.escape(group.id)}">− Remover unidade</button>`:''}</div></section>`;
    }).join('');
    document.getElementById('customization-title').textContent=promotion.name;
    const pricingHelp=promotion.discount_percent!=null?`${Number(promotion.discount_percent)}% de desconto sobre o preço normal dos itens e opções escolhidos. Não há acréscimo separado por sabor.`:`Preço base: ${this.money(Number(promotion.combo_price))}. Acréscimos por escolha aparecem ao lado dos itens.`;
    document.getElementById('customization-content').innerHTML=`<div class="customization-intro"><div><strong>${this.escape(promotion.description||promotion.name)}</strong><span>${pricingHelp}</span></div></div>${html}<p class="customization-help">Cada unidade pode ter opções próprias. O ERP confirma o estoque e recalcula o preço ao fechar o pedido.</p>`;
    document.getElementById('customization-add').textContent='Adicionar combo';
  },
  readComboSelection(){
    const promotion=this.pendingCombo;if(!promotion)return null;const selections=[];
    for(const group of promotion.groups){const items=[];for(const slot of document.querySelectorAll(`[data-combo-slot][data-group-id="${group.id}"]`)){
      const productId=slot.querySelector('[data-combo-product]')?.value,options={};
      for(const input of slot.querySelectorAll('[data-combo-option]:checked')){const key=input.dataset.optionKey;if(input.type==='checkbox'){options[key]||=[];options[key].push(input.value)}else options[key]=input.value}
      items.push({productId,quantity:1,options});
    }
      if(items.length<group.requiredQuantity||items.length>group.maxQuantity){this.toast(`Confira a quantidade de ${group.name}.`);return null;}
      for(const item of items){const product=this.products.find(p=>p.id===item.productId);if(!product||!Number.isFinite(this.productUnitPrice(product,item.options))){this.toast('Uma opção está sem preço cadastrado.');return null;}}
      selections.push({groupId:group.id,items});
    }
    return selections;
  },
  stockLimit(product){return this.storefront?.allowOrdersWithoutStockForTesting===true||product.current_stock==null?20:Math.min(20,Number(product.current_stock))},
  beginAdd(id){if(!this.apiActive)return;const product=this.products.find(item=>item.id===id);if(!product||this.qty(id)>=this.stockLimit(product))return;const config=this.customizationConfig(product);if(!config){this.change(id,1,{});return}this.pendingCustomization={product,config};this.renderCustomization();this.decorateCustomizationPromotion();const overlay=document.getElementById('customization-overlay');overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'},
  renderCustomization(){const pending=this.pendingCustomization;if(!pending)return;const {product,config}=pending;const saved=this.productOptions.get(product.id)||{};const groups=config.groups.map(group=>{const type=group.type||'radio';const selected=type==='checkbox'?(Array.isArray(saved[group.key])?saved[group.key]:[]):saved[group.key]||'';const options=group.options.map(([value,label])=>`<label class="customization-option"><input type="${type}" name="custom-${this.escape(group.key)}" value="${this.escape(value)}" ${type==='checkbox'?(selected.includes(value)?'checked':''):(selected===value?'checked':'')}><span>${this.escape(label)}</span></label>`).join('');return`<fieldset class="customization-group"><legend>${this.escape(group.label)} ${group.required?'<span class="customization-required">Obrigatório</span>':''}</legend><div class="customization-options">${options}</div></fieldset>`}).join('');document.getElementById('customization-title').textContent=product.name;document.getElementById('customization-content').innerHTML=`<div class="customization-intro"><img src="${this.escape(this.image(product.photo_url))}" alt="${this.escape(product.name)}" onerror="this.onerror=null;this.src='./assets/products/petiscos-referencia.jpg'"><div><strong>${this.escape(product.name)}</strong><span>${this.money(Number(product.sale_price))} · escolha como você prefere</span></div></div>${groups}<p class="customization-help">As opções escolhidas aparecem junto ao item no pedido.</p>`},
  readCustomization(){const pending=this.pendingCustomization;if(!pending)return null;const options={};for(const group of pending.config.groups){const type=group.type||'radio';const inputs=[...document.querySelectorAll(`input[name="custom-${group.key}"]`)];const selected=inputs.filter(input=>input.checked).map(input=>input.value);if(group.required&&!selected.length){this.toast(`Escolha: ${group.label}.`);return null}if(selected.length)options[group.key]=type==='checkbox'?selected:selected[0]}return options},
  confirmCustomization(){if(this.pendingCombo){const selections=this.readComboSelection();if(!selections)return;this.combos.set(crypto.randomUUID(),{promotion:this.pendingCombo,selections});this.pendingCombo=null;this.closeCustomization();if(this.coupon)this.clearCoupon('Carrinho alterado. Aplique o cupom novamente.');this.renderCart();if(typeof document.querySelector==='function')this.refreshQuote();return}const options=this.readCustomization();if(!options)return;const product=this.pendingCustomization.product;if(!Number.isFinite(this.productUnitPrice(product,options))){this.toast('Preço indisponível. Atualize o cardápio.');return}this.change(product.id,1,options);this.closeCustomization()},
  closeCustomization(){this.pendingCustomization=null;this.pendingCombo=null;const overlay=document.getElementById('customization-overlay');overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');document.body.style.overflow=''},
  cartProductId(key){return String(key).split('::')[0]},
  cartKey(productId,options={}){return `${productId}::${encodeURIComponent(JSON.stringify(options||{}))}`},
  qty(id){const direct=[...this.cart].reduce((total,[key,quantity])=>total+(this.cartProductId(key)===id?quantity:0),0);const combo=[...this.combos.values()].flatMap(combo=>combo.selections.flatMap(group=>group.items)).filter(item=>item.productId===id).reduce((sum,item)=>sum+item.quantity,0);return direct+combo},
  supportsFlavoredIce(id){return ['p-drk010','p-drk011'].includes(id)},
  change(id,delta,options){if(!this.apiActive)return;const productId=this.cartProductId(id),product=this.products.find(p=>p.id===productId);if(!product)return;let key;if(this.cart.has(id))key=id;else if(delta<0&&!options)key=[...this.cart.keys()].filter(item=>this.cartProductId(item)===productId).at(-1)||this.cartKey(productId,{});else key=this.cartKey(productId,options||{});const current=this.cart.get(key)||0,available=Math.max(0,this.stockLimit(product)-this.qty(productId)+current),qty=Math.max(0,Math.min(available,current+delta));if(qty){this.cart.set(key,qty);this.productOptions.set(key,options||this.productOptions.get(key)||{})}else{this.cart.delete(key);this.productOptions.delete(key)}if(this.coupon)this.clearCoupon('Carrinho alterado. Aplique o cupom novamente.');this.renderCatalog();this.decoratePromotionPrices();this.renderCart();if(typeof document.querySelector==='function')this.refreshQuote()},
  categories(){const available=new Set(this.products.map(p=>this.categoryLabel(p.category,p)));const hasDrinks=[...available].some(c=>c.startsWith('Bebidas ·'));return ['Todos',...this.categoryOrder.filter(c=>available.has(c)||(c==='Bebidas'&&hasDrinks)),...([...available].filter(c=>!this.categoryOrder.includes(c))) ]},
  renderCategories(){document.getElementById('category-list').innerHTML=this.categories().map(c=>`<button class="category-button ${c===this.category?'active':''}" data-category="${this.escape(c)}">${this.escape(c)}</button>`).join('')},
  renderCatalog(){
    if(!this.apiActive){document.getElementById('catalog').innerHTML='<div class="catalog-empty">Cardápio temporariamente indisponível.<br><button type="button" data-retry>Tentar novamente</button></div>';return}
    const list=this.products.filter(p=>this.categoryMatches(p,this.category)&&(`${p.name} ${p.description}`.toLowerCase().includes(this.search))).sort((a,b)=>{
      const rank=p=>this.categoryOrder.indexOf(this.categoryLabel(p.category,p).split(' · ')[0]);
      return (rank(a)<0?999:rank(a))-(rank(b)<0?999:rank(b));
    });
    document.getElementById('catalog').innerHTML=list.length?list.map(p=>{const q=this.qty(p.id),stock=this.stockLimit(p),unavailable=stock<=0,label=this.featuredProducts().some(item=>item.id===p.id)?this.editorialLabel(p):'',notice=this.productNotice(p),category=this.categoryLabel(p.category,p),meta=unavailable?'Indisponível':'Disponível';return `<article class="product-card ${q?'selected':''}"><img class="product-image" src="${this.escape(this.image(p.photo_url))}" alt="${this.escape(p.name)}" loading="lazy" onerror="this.onerror=null;this.src='./assets/products/snacks.jpg'"><div class="product-info"><div class="product-title-row"><span class="product-category">${this.escape(category)}</span>${label?`<em class="product-badge">${label}</em>`:''}</div><h2>${this.escape(p.name)}</h2><p class="product-description">${this.escape(this.displayDescription(p))}</p>${notice?`<p class="allergen-note">${this.escape(notice)}</p>`:''}<small class="availability-note">${meta}</small><div class="product-footer"><span class="product-price">${unavailable?'Indisponível':this.money(Number(p.sale_price))}</span><div class="qty-control" aria-label="Quantidade"><button data-action="dec" data-id="${this.escape(p.id)}" ${q?'':'disabled'} aria-label="Diminuir">−</button><output>${q}</output><button data-action="inc" data-id="${this.escape(p.id)}" ${unavailable||q>=stock?'disabled':''} aria-label="Adicionar">Adicionar</button></div></div></div></article>`}).join(''):'<div class="catalog-empty">Nenhum produto encontrado.</div>';
  },
  decoratePromotionPrices(){document.querySelectorAll('#catalog .product-card').forEach(card=>{const title=card.querySelector('h2')?.textContent,product=this.products.find(item=>item.name===title),promo=this.productPromotion(product);if(!product||!promo)return;const price=card.querySelector('.product-price');if(price)price.innerHTML=`<span class="price-promo"><em>-${promo.discount}%</em><del>${this.money(promo.normal)}</del><strong>${this.money(promo.final)}</strong></span>`})},
  decorateCustomizationPromotion(){const product=this.pendingCustomization?.product,promo=this.productPromotion(product),target=document.querySelector('.customization-intro span');if(!promo||!target)return;target.innerHTML=`<span class="price-promo"><em>-${promo.discount}%</em><del>${this.money(promo.normal)}</del><strong>${this.money(promo.final)}</strong></span> · escolha como você prefere`},
  cartData(){return [...this.cart].map(([key,quantity])=>({key,product:this.products.find(p=>p.id===this.cartProductId(key)),quantity,options:this.productOptions.get(key)||{}})).filter(i=>i.product)},
  comboData(){return [...this.combos.values()]},
  comboLines(){return this.comboData().flatMap(combo=>combo.selections.flatMap(group=>group.items.map(item=>({...item,product:this.products.find(product=>product.id===item.productId),promotion:combo.promotion,groupId:group.groupId,groupName:combo.promotion.groups.find(groupInfo=>groupInfo.id===group.groupId)?.name}))))},
  allPromotionsPayload(){return this.comboData().map(combo=>({promotionId:combo.promotion.id,selections:combo.selections}))},
  cartPayloadItems(){return this.cartData().map(i=>({productId:i.product.id,quantity:i.quantity,expectedUnitPrice:this.productUnitPrice(i.product,i.options),options:i.options,flavoredIce:Boolean(i.options.flavoredIce)}))},
  comboAppliedPrice(combo){const percent=combo.promotion.discount_percent;let total=percent!=null?0:Number(combo.promotion.combo_price);for(const groupSelection of combo.selections){const group=combo.promotion.groups.find(item=>item.id===groupSelection.groupId);for(const selected of groupSelection.items){const product=this.products.find(item=>item.id===selected.productId);if(!product)continue;if(percent!=null){total+=this.productUnitPrice(product,selected.options||{})*Number(selected.quantity||1);continue;}const allowed=group?.products.find(item=>item.id===selected.productId);const optionExtra=Math.max(0,this.productUnitPrice(product,selected.options||{})-Number(product.sale_price));total+=(Number(allowed?.surcharge||0)+optionExtra)*Number(selected.quantity||1)}}total=Math.round((total+Number.EPSILON)*100)/100;if(percent!=null)total-=Math.round((total*Number(percent)/100+Number.EPSILON)*100)/100;return Math.round((total+Number.EPSILON)*100)/100},
  subtotal(){const direct=this.cartData().reduce((s,i)=>s+this.productUnitPrice(i.product,i.options)*i.quantity,0);const combos=this.comboData().reduce((sum,combo)=>sum+this.comboAppliedPrice(combo),0);return Math.round((direct+combos+Number.EPSILON)*100)/100},
  hasAlcohol(){return [...this.cartData().map(i=>i.product),...this.comboLines().map(i=>i.product).filter(Boolean)].some(product=>['Drinks','Cervejas'].includes(product.category))},
  renderCart(){
    const data=this.cartData(),comboLines=this.comboLines(),comboCount=this.comboData().reduce((sum,combo)=>sum+combo.selections.reduce((n,group)=>n+group.items.reduce((m,item)=>m+item.quantity,0),0),0),count=data.reduce((s,i)=>s+i.quantity,0)+comboCount,subtotal=this.subtotal();
    document.getElementById('cart-fab').classList.toggle('hidden',!count);document.getElementById('cart-count').textContent=count;document.getElementById('cart-fab-total').textContent=this.money(Math.max(0,(this.quote?.subtotalNormal??subtotal)-(this.quote?.promotionDiscount||0)-(this.coupon?.discount||0)));
    const direct=data.map(i=>`<div class="cart-item"><div><strong>${this.escape(i.product.name)}</strong><small>${i.quantity} × ${Number.isFinite(this.productUnitPrice(i.product,i.options))?this.money(this.productUnitPrice(i.product,i.options)):'Preço indisponível'}${this.optionSummary(i.options)}</small></div><div class="qty-control"><button data-action="dec" data-id="${this.escape(i.key)}">−</button><output>${i.quantity}</output><button data-action="inc" data-id="${this.escape(i.key)}">+</button></div></div>`);
    const comboCards=[...this.combos.entries()].map(([instanceId,combo])=>{const summary=combo.selections.flatMap(group=>group.items.map(item=>{const product=this.products.find(p=>p.id===item.productId);const groupName=combo.promotion.groups.find(p=>p.id===group.groupId)?.name;return `${groupName}: ${product?.name||item.productId}${this.optionSummary(item.options)}`})).map(value=>this.escape(value)).join('<br>');return `<div class="combo-cart-item"><div><strong class="combo-cart-title">${this.escape(combo.promotion.name)} · ${this.money(this.comboAppliedPrice(combo))}</strong><small>${summary}</small></div><button type="button" data-combo-remove="${this.escape(instanceId)}">Remover</button></div>`});
    document.getElementById('cart-items').innerHTML=[...comboCards,...direct].join('');
    this.renderCheckout();
  },
  renderCheckout(){const delivery=document.querySelector('[name="fulfillment"]:checked')?.value==='entrega',deliveryResult=delivery?this.deliveryForPostalCode(document.querySelector('[name="postalCode"]')?.value):null,deliveryFee=deliveryResult?.fee??0,promoDiscount=this.quote?.promotionDiscount||0,discount=promoDiscount+(this.coupon?.discount||0),cartLines=[...this.cartData().map(i=>({product:i.product,quantity:i.quantity})),...this.comboLines().filter(i=>i.product).map(i=>({product:i.product,quantity:i.quantity}))],stockTotals=new Map();cartLines.forEach(i=>stockTotals.set(i.product.id,(stockTotals.get(i.product.id)||0)+i.quantity));const stockShort=[...stockTotals].some(([id,quantity])=>{const product=this.products.find(p=>p.id===id);return product&&this.stockLimit(product)<quantity}),priceMissing=!Number.isFinite(this.subtotal()),needsQuote=this.cart.size>0||this.combos.size>0,ready=this.apiActive&&this.storefront?.isOpen&&!stockShort&&!priceMissing&&!this.submitting&&(!needsQuote||!this.quoteBusy)&&(!needsQuote||this.quote!==null)&&(!delivery||deliveryResult!==null);document.getElementById('address-fields').classList.toggle('hidden',!delivery);document.querySelectorAll('[data-delivery-required]').forEach(field=>field.required=delivery);document.getElementById('delivery-row').classList.toggle('hidden',!delivery);document.getElementById('coupon-section').classList.toggle('hidden',!this.apiActive);document.getElementById('discount-row').classList.toggle('hidden',!discount);document.getElementById('checkout-discount').textContent=`- ${this.money(discount)}`;document.getElementById('adult-field').classList.toggle('hidden',!this.hasAlcohol());document.getElementById('checkout-subtotal').textContent=priceMissing?'Preço indisponível':this.money(this.quote?.subtotalNormal??this.subtotal());document.getElementById('checkout-delivery').textContent=delivery?(deliveryResult?this.money(deliveryFee):'Área não atendida'):'R$ 0,00';document.getElementById('checkout-total').textContent=priceMissing?'Preço indisponível':this.money(Math.max(0,(this.quote?.subtotalNormal??this.subtotal())+(delivery&&this.apiActive?deliveryFee:0)-discount));const btn=document.getElementById('checkout-button');btn.textContent='Confirmar pedido';btn.disabled=!ready;document.getElementById('checkout-help').textContent=!this.apiActive?'Cardápio indisponível. Aguarde a conexão com o ERP.':!this.storefront.isOpen?'A loja está fechada no momento.':this.quoteBusy?'Calculando promoções…':needsQuote&&!this.quote?`Não foi possível confirmar preço/promoção no ERP${this.quoteError?`: ${this.couponError(this.quoteError)}`:'. Atualize o carrinho.'}`:priceMissing?'O preço de uma opção mudou. Remova o item e escolha novamente.':delivery&&!deliveryResult?'Ainda não entregamos nessa área. Confira o CEP ou escolha retirada.':stockShort?'O estoque de um item do carrinho mudou. Ajuste a quantidade.':this.storefront.allowOrdersWithoutStockForTesting?'MODO DE TESTES: este pedido será identificado como teste no ERP; o estoque real não será alterado.':delivery?'A taxa de entrega será confirmada pelo estabelecimento antes do pedido.':'O pedido será enviado ao estabelecimento para confirmação.'},
  async refreshQuote(){const sequence=++this.quoteSequence,items=this.cartPayloadItems(),combos=this.allPromotionsPayload();if(!items.length&&!combos.length){this.quote=null;this.quoteError=null;this.quoteBusy=false;this.renderCheckout();return}this.quoteBusy=true;this.quoteError=null;this.renderCheckout();try{const response=await fetch(this.endpoint('/public/pricing/quote'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,combos}),signal:AbortSignal.timeout(8000)});const body=await response.json();if(!response.ok)throw new Error(body.error);if(sequence!==this.quoteSequence)return;this.quote={subtotalNormal:body.data.subtotalNormal,promotionDiscount:body.data.promotions.reduce((sum,promo)=>sum+Number(promo.discount||0),0),promotions:body.data.promotions,rejectedPromotions:body.data.rejectedPromotions};this.renderCart()}catch(error){if(sequence===this.quoteSequence){this.quote=null;this.quoteError=error.message;this.renderCheckout()}}finally{if(sequence===this.quoteSequence){this.quoteBusy=false;this.renderCheckout()}}},
  clearCoupon(message=''){this.coupon=null;document.getElementById('coupon-status').textContent=message;this.renderCheckout()},
  couponError(code){return({coupon_already_used:'Este cupom já foi usado por este telefone.',first_order_only:'Este cupom é somente para o primeiro pedido deste telefone.',coupon_not_found:'Cupom inválido ou fora da validade.',coupon_not_combinable:'Este cupom não acumula com a promoção aplicada.',invalid_phone:'Digite um WhatsApp válido para aplicar o cupom.',product_unavailable:'Um produto do carrinho não está mais disponível.',product_options_required:'Escolha todas as opções obrigatórias do produto.',product_options_invalid:'Uma opção escolhida não é válida para este produto.',combo_group_required:'Escolha os componentes obrigatórios do combo.',combo_group_quantity:'Confira a quantidade escolhida em cada grupo.',combo_product_not_allowed:'Um produto escolhido não faz parte deste combo.',combo_options_not_allowed:'Uma opção escolhida não está disponível neste combo.',combo_price_exceeds_normal:'O preço do combo está acima do preço normal dos componentes.',promotion_not_started:'Esta promoção ainda não começou.',promotion_expired:'Esta promoção terminou.'})[code]||'Não foi possível validar o preço, a promoção ou o cupom.'},
  async applyCoupon(){const form=document.getElementById('checkout-form'),code=form.elements.couponCode.value.trim().toUpperCase(),phone=form.elements.phone.value.trim(),button=document.getElementById('coupon-apply');if(!code){this.toast('Digite o cupom.');return}if(!phone){this.toast('Digite seu WhatsApp antes de aplicar o cupom.');return}button.disabled=true;document.getElementById('coupon-status').textContent='Verificando…';try{const response=await fetch(this.endpoint('/public/coupons/validate'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,phone,items:this.cartPayloadItems(),combos:this.allPromotionsPayload()})});const body=await response.json();if(!response.ok)throw new Error(body.error);this.coupon=body.data;this.quote={subtotalNormal:body.data.subtotalNormal,promotionDiscount:body.data.promotionDiscount,promotions:body.data.promotions||[]};document.getElementById('coupon-status').textContent=`Cupom aplicado: ${body.data.description}.`;this.renderCart()}catch(error){this.coupon=null;if(error.message==='catalog_changed'){await this.refresh();document.getElementById('coupon-status').textContent='O preço mudou. Confira o carrinho e aplique novamente.'}else document.getElementById('coupon-status').textContent=this.couponError(error.message);this.renderCheckout()}finally{button.disabled=false}},
  openCart(open){document.getElementById('cart-overlay').classList.toggle('open',open);document.getElementById('cart-overlay').setAttribute('aria-hidden',String(!open));document.body.style.overflow=open?'hidden':''},
  productUnitPrice(product,options={}){let price=Number(product.sale_price);const groups=Array.isArray(product.option_groups)?product.option_groups:[];if(groups.length){for(const group of groups){const selected=options[group.key],values=Array.isArray(selected)?selected:selected===undefined?[]:[selected];for(const value of values){const choice=group.options.find(option=>option.value===value);if(!choice)continue;const linked=choice.priceProductId?this.products.find(item=>item.id===choice.priceProductId):null,linkedPrice=linked?Number(linked.sale_price):Number(choice.priceProductPrice);if(choice.priceMode==='replace')price=Number.isFinite(linkedPrice)?linkedPrice:NaN;else if(choice.priceMode==='add')price+=Number.isFinite(linkedPrice)?linkedPrice:NaN}}}else{if(product.id==='p-drk001'&&['morango','maracuja'].includes(options.flavor))price=product.option_prices?.flavors?.[options.flavor]==null?NaN:Number(product.option_prices.flavors[options.flavor]);if(['p-pet001','p-pet002'].includes(product.id)&&options.size==='G')price=product.option_prices?.G==null?NaN:Number(product.option_prices.G);if(['p-drk010','p-drk011'].includes(product.id)&&options.size==='700ml')price=Number(product.option_prices?.['700ml']);if(product.id==='p-pet002'&&options.drink&&options.drink!=='none')price+=Number(product.option_prices?.drinks?.[options.drink]);if(product.id==='p-ref001'&&options.sodaFlavor)price=Number(product.option_prices?.soda?.[options.sodaFlavor])}return Number.isFinite(price)?Math.round((price+Number.EPSILON)*100)/100:NaN},
  optionSummary(options={}){const parts=[];if(options.flavor)parts.push(options.flavor==='maracuja'?'Maracujá':options.flavor==='natural'?'Limão':options.flavor[0].toUpperCase()+options.flavor.slice(1));if(options.sodaFlavor)parts.push({'coca-cola':'Coca-Cola',guarana:'Guaraná Antarctica',sprite:'Sprite'}[options.sodaFlavor]||options.sodaFlavor);if(Array.isArray(options.complement)&&options.complement.length)parts.push(`+ ${options.complement.join(', ')}`);if(options.size)parts.push(options.size);if(options.beverage)parts.push(options.beverage==='vodka'?'Vodka Smirnoff':'Whisky');if(options.iceFlavor)parts.push(`gelo de ${options.iceFlavor==='maracuja'?'maracujá':options.iceFlavor}`);if(options.drink&&options.drink!=='none')parts.push({'coca-cola':'Coca-Cola',guarana:'Guaraná',agua:'Água'}[options.drink]||options.drink);return parts.length?` · ${this.escape(parts.join(' · '))}`:''},
  payload(form){const data=new FormData(form),fulfillmentType=this.tableNumber?'retirada':data.get('fulfillment');return{customer:{name:data.get('name'),phone:data.get('phone')},fulfillmentType,tableNumber:this.tableNumber,address:{postalCode:data.get('postalCode')||'',city:data.get('city')||'',street:data.get('street')||'',number:data.get('number')||'',district:data.get('district')||'',complement:data.get('complement')||'',reference:data.get('reference')||''},paymentMethod:data.get('payment'),couponCode:this.coupon?.code||'',useLoyalty:data.get('useLoyalty')==='on',notes:data.get('notes')||'',adultConfirmed:data.get('adultConfirmed')==='on',website:data.get('website')||'',items:this.cartPayloadItems(),combos:this.allPromotionsPayload()}},
  async idempotencyKeyFor(payload){const bytes=new TextEncoder().encode(JSON.stringify(payload)),digest=await crypto.subtle.digest('SHA-256',bytes),hash=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join(''),storageKey='petisbar-pending-order';let saved=null;try{saved=JSON.parse(sessionStorage.getItem(storageKey)||'null')}catch{}if(saved?.hash===hash&&saved.key)return saved.key;const key=crypto.randomUUID();sessionStorage.setItem(storageKey,JSON.stringify({hash,key}));return key},
  validate(payload){if(!this.apiActive||!this.storefront)return'Cardápio indisponível. Tente novamente em instantes.';if(!this.storefront.isOpen)return'A loja está fechada no momento.';if(!payload.items.length&&!payload.combos.length)return'Adicione pelo menos um produto ou combo.';if(!Number.isFinite(this.subtotal()))return'O preço de uma opção mudou. Remova o item e escolha novamente.';if(this.quoteBusy||!this.quote)return'Aguarde o ERP confirmar as promoções e os preços.';const productCounts=new Map();[...this.cartData().map(i=>({product:i.product,quantity:i.quantity})),...this.comboLines().filter(i=>i.product).map(i=>({product:i.product,quantity:i.quantity}))].forEach(i=>productCounts.set(i.product.id,(productCounts.get(i.product.id)||0)+i.quantity));if([...productCounts].some(([id,quantity])=>this.stockLimit(this.products.find(p=>p.id===id))<quantity))return'O estoque de um item mudou. Ajuste a quantidade.';if(this.subtotal()<Number(this.storefront.minimumOrder ?? 20))return`O pedido mínimo é de ${this.money(Number(this.storefront.minimumOrder ?? 20))}.`;if(payload.fulfillmentType==='entrega'&&(!payload.address.postalCode||!payload.address.city||!payload.address.street||!payload.address.number||!payload.address.district))return'Preencha CEP, cidade, rua, número e bairro.';if(payload.fulfillmentType==='entrega'&&!this.deliveryForPostalCode(payload.address.postalCode))return'Ainda não entregamos nessa área. Confira o CEP ou escolha retirada.';if(this.hasAlcohol()&&!payload.adultConfirmed)return'Confirme que você tem 18 anos ou mais.';return''},
  async submit(event){
    event.preventDefault();
    if(this.submitting)return;
    this.submitting=true;
    this.renderCheckout();
    const form=event.currentTarget;
    try{
      await this.refresh();
      await this.refreshQuote();
      const payload=this.payload(form),error=this.validate(payload);
      if(error){this.toast(error);return}
      payload.idempotencyKey=await this.idempotencyKeyFor(payload);
      const response=await fetch(this.endpoint('/public/orders'),{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':payload.idempotencyKey},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
      const body=await response.json().catch(()=>({}));
      if(!response.ok){
        if(['catalog_changed','product_unavailable','insufficient_stock','payment_unavailable','minimum_order_not_met','delivery_area_unavailable'].includes(body.error)){
          await this.refresh();this.toast(body.error==='delivery_area_unavailable'?'Ainda não entregamos nessa área. Confira o CEP ou escolha retirada.':'O cardápio mudou. Confira preços, disponibilidade e pagamento antes de tentar novamente.');
        }else if(body.error==='store_closed'){
          await this.refresh();this.toast('A loja está fechada no momento.');
        }else this.toast(this.couponError(body.error)+(body.error?` [${body.error}]`:''));
        return;
      }
      const paymentIsPix=String(body.data?.paymentMethod||payload.paymentMethod||'').trim().toLowerCase()==='pix';
      if(body.data?.trackingToken&&paymentIsPix) await this.startPixPayment(body.data.id,body.data.trackingToken);
      this.cart.clear();this.productOptions.clear();this.flavoredIce.clear();this.combos.clear();this.coupon=null;this.quote=null;sessionStorage.removeItem('petisbar-pending-order');
      this.renderPromotions();this.renderCatalog();this.renderCart();this.openCart(false);
      if(body.data.trackingToken)localStorage.setItem('petisbar.lastTrackingToken',body.data.trackingToken);
      if(body.data.trackingToken){
        const confirmationNumber=document.getElementById('order-confirmation-number'),confirmation=document.getElementById('order-confirmation');
        if(confirmationNumber)confirmationNumber.textContent=`Pedido #${body.data.orderNumber}`;
        if(confirmation){confirmation.classList.remove('hidden');confirmation.scrollIntoView({behavior:'smooth',block:'center'});}
      }
      this.toast(this.storefront?.allowOrdersWithoutStockForTesting?`Pedido de teste #${body.data.orderNumber} registrado!`:`Pedido #${body.data.orderNumber} recebido!`);
      form.reset();
    }catch{
      this.apiActive=false;this.products=[];this.storefront=null;
      this.openCart(false);this.renderCategories();this.renderCatalog();this.renderCart();
      document.getElementById('service-notice').classList.remove('hidden');
      document.getElementById('service-notice').textContent='Não foi possível confirmar o pedido. Consulte o estabelecimento antes de tentar novamente.';
      this.toast('Conexão interrompida. Confira se o pedido foi recebido antes de reenviar.');
    }finally{this.submitting=false;this.renderCheckout()}
  },
  toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.classList.remove('show'),3500)},
};
document.addEventListener('DOMContentLoaded',()=>Cardapio.init());
