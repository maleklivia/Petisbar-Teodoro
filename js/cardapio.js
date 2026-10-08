const Cardapio = {
  storefront: null,
  apiActive: false, products: [], promotions: [], cart: new Map(), productOptions: new Map(), combos: new Map(), pendingCustomization: null, pendingCombo: null, pendingComboCounts: new Map(), category: 'Todos', search: '', deliveryFee: 0, coupon: null, quote: null, quoteError: null, quoteSequence: 0, quoteBusy: false, tableNumber: '', refreshPromise: null, submitting: false,
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
        for(const [instanceId,combo] of this.combos)if(!promotions.some(promotion=>promotion.id===combo.promotion.id)){this.combos.delete(instanceId);this.toast('Um combo saiu do cardápio e foi removido do carrinho.')}
        if(this.pendingCustomization&&!products.some(p=>p.id===this.pendingCustomization.product.id))this.closeCustomization();
        if(this.coupon&&(products.some(p=>previous.get(p.id)!==JSON.stringify([p.name,p.category,p.description,p.sale_price,p.photo_url,p.current_stock,p.option_prices]))||previousPromotions!==JSON.stringify(promotions)))this.coupon=null;
        this.renderStorefront();
        this.renderPromotions();
        const notice=document.getElementById('service-notice');
        const testMode=storefront.allowOrdersWithoutStockForTesting===true;
        notice.classList.toggle('hidden',!this.tableNumber&&!testMode);
        if(testMode)notice.textContent=`MODO DE TESTES — itens liberados sem estoque real. Pedidos serão registrados como teste e dependem de confirmação.${this.tableNumber?` Mesa ${this.tableNumber}.`:''}`;
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
      this.renderCategories();this.renderCatalog();this.renderCart();if((this.cart.size||this.combos.size)&&typeof document.querySelector==='function')this.refreshQuote();
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
    const status=document.getElementById('store-status');if(status){status.classList.toggle('open',Boolean(data.isOpen));status.classList.toggle('closed',!data.isOpen);status.querySelector('strong').textContent=data.isOpen?'Aberto agora':'Fechado agora'}
    const promotion=(Array.isArray(data.promotions)&&data.promotions[0])||{};const promotionText=document.getElementById('promotion-text');if(promotionText)promotionText.textContent=promotion.description||'Confira as promoções disponíveis no cardápio.';
    const whatsapp=document.querySelector('#store-panel-contato a');if(whatsapp&&data.whatsapp)whatsapp.href=`https://wa.me/${String(data.whatsapp).replace(/\D/g,'')}`;
    const select=document.querySelector('[name="payment"]');if(select){const selected=select.value;select.innerHTML=payments.map(method=>`<option>${this.escape(method)}</option>`).join('');if(payments.includes(selected))select.value=selected}
  },
  renderPromotions(){
    const el=document.getElementById('combo-catalog');if(!el)return;
    const available=this.promotions.filter(p=>p.rule_type==='combo'&&p.combo_price!=null&&p.groups?.length);
    const discounts=this.promotions.filter(p=>p.rule_type!=='combo');
    const text=document.getElementById('promotion-text');if(text)text.textContent=available.length||discounts.length?`${available.map(p=>p.name).join(' · ')}${discounts.length?' · Descontos aplicados automaticamente no carrinho':''}`:'Confira as promoções disponíveis no cardápio.';
    if(!available.length){el.classList.add('hidden');el.innerHTML='';return}
    el.classList.remove('hidden');el.innerHTML=available.map(p=>{
      const selected=[...this.combos.values()].filter(combo=>combo.promotion.id===p.id).length,groups=(p.groups||[]).map(group=>`${group.requiredQuantity} ${this.escape(group.name.toLowerCase())}`).join(' + ');
      return `<article class="combo-card"><span class="product-category">COMBO</span><h2>${this.escape(p.name)}</h2><p>${this.escape(p.description||groups)}</p><p>${groups}</p><strong>${this.money(Number(p.combo_price))}</strong><button type="button" data-combo-add="${this.escape(p.id)}">${selected?`Adicionar outro · ${selected} no carrinho`:'Montar combo'}</button></article>`;
    }).join('');
  },
  categoryOrder: ['BATATAS RECHEADAS','Petiscos','Açaí','Drinks','Cervejas','Bebidas','Conveniência'],
  categoryLabel(category){return ['Refrigerantes','Águas','Energéticos'].includes(category)?'Bebidas':category},
  categoryMatches(product, category){return category==='Todos'||this.categoryLabel(product.category)===category},
  async init(){
    this.tableNumber=(new URLSearchParams(location.search).get('mesa')||'').trim().slice(0,20);
    this.bind();
    if(this.tableNumber){const pickup=document.querySelector('[name="fulfillment"][value="retirada"]');if(pickup)pickup.checked=true;document.querySelectorAll('[name="fulfillment"]').forEach(input=>input.disabled=true)}
    await this.refresh();
    setInterval(()=>{if(!document.hidden)this.refresh()},15000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.refresh()});
    window.addEventListener('focus',()=>this.refresh());
  },
  bind(){
    document.querySelectorAll('[data-store-tab]').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('[data-store-tab]').forEach(item=>item.classList.toggle('active',item===tab));document.querySelectorAll('.store-panel').forEach(panel=>panel.classList.toggle('hidden',panel.id!==`store-panel-${tab.dataset.storeTab}`))}));
    document.getElementById('catalog-search').addEventListener('input',e=>{this.search=e.target.value.toLowerCase();this.renderCatalog()});
    document.getElementById('category-list').addEventListener('click',e=>{const button=e.target.closest('[data-category]');if(!button)return;this.category=button.dataset.category;this.renderCategories();this.renderCatalog()});
    document.getElementById('catalog').addEventListener('click',e=>{if(e.target.closest('[data-retry]')){this.refresh();return}const button=e.target.closest('[data-action]');if(button){if(button.dataset.action==='inc')this.beginAdd(button.dataset.id);else this.change(button.dataset.id,-1)}});
    document.getElementById('combo-catalog').addEventListener('click',e=>{const button=e.target.closest('[data-combo-add]');if(button){const promotion=this.promotions.find(item=>item.id===button.dataset.comboAdd);if(promotion)this.beginCombo(promotion);}});
    document.getElementById('customization-content').addEventListener('change',e=>{if(this.pendingCombo&&(e.target.matches('[data-combo-product]'))){this.captureComboDraft();this.renderComboCustomization();}});
    document.getElementById('customization-content').addEventListener('click',e=>{const button=e.target.closest('[data-combo-quantity]');if(!button||!this.pendingCombo)return;const group=this.pendingCombo.groups.find(item=>item.id===button.dataset.groupId);if(!group)return;this.captureComboDraft();const count=this.pendingComboCounts.get(group.id)||group.requiredQuantity;const next=Math.max(group.requiredQuantity,Math.min(group.maxQuantity,count+Number(button.dataset.comboQuantity)));this.pendingComboCounts.set(group.id,next);this.renderComboCustomization();});
    document.getElementById('catalog').addEventListener('change',e=>{if(e.target.matches('[data-flavored-ice]')){this.flavoredIce.set(e.target.dataset.flavoredIce,e.target.checked);if(this.coupon)this.clearCoupon('Opção alterada. Aplique o cupom novamente.');this.renderCart()}});
    document.getElementById('cart-items').addEventListener('click',e=>{const remove=e.target.closest('[data-combo-remove]');if(remove){this.combos.delete(remove.dataset.comboRemove);if(this.coupon)this.clearCoupon('Carrinho alterado. Aplique o cupom novamente.');this.renderCart();this.renderPromotions();this.refreshQuote();return}const button=e.target.closest('[data-action]');if(button)this.change(button.dataset.id,button.dataset.action==='inc'?1:-1)});
    document.getElementById('cart-fab').addEventListener('click',()=>this.openCart(true));document.getElementById('cart-close').addEventListener('click',()=>this.openCart(false));
    document.getElementById('cart-overlay').addEventListener('click',e=>{if(e.target.id==='cart-overlay')this.openCart(false)});
    document.querySelectorAll('[name="fulfillment"]').forEach(input=>input.addEventListener('change',()=>this.renderCheckout()));
    document.getElementById('coupon-apply').addEventListener('click',()=>this.applyCoupon());
    document.getElementById('coupon-code').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase();if(this.coupon&&e.target.value!==this.coupon.code)this.clearCoupon('Aplique o cupom novamente.')});
    document.getElementById('checkout-form').addEventListener('submit',e=>this.submit(e));
    document.getElementById('customization-close').addEventListener('click',()=>this.closeCustomization());
    document.getElementById('customization-cancel').addEventListener('click',()=>this.closeCustomization());
    document.getElementById('customization-add').addEventListener('click',()=>this.confirmCustomization());
    document.getElementById('customization-overlay').addEventListener('click',e=>{if(e.target.id==='customization-overlay')this.closeCustomization()});
  },
  customizationConfig(product){
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
        return `<div class="combo-choice-slot" data-combo-slot data-group-id="${this.escape(group.id)}" data-slot="${index}"><label>Escolha ${this.escape(group.name.toLowerCase())} ${index+1}<select data-combo-product>${allowed.map(product=>`<option value="${this.escape(product.id)}" ${selected.id===product.id?'selected':''}>${this.escape(product.name)}${Number(product.surcharge)?` (+ ${this.money(Number(product.surcharge))})`:''}</option>`).join('')}</select></label>${options}</div>`;
      }).join('');
      return `<section class="combo-group-builder"><h3>${this.escape(group.name)} <small>${group.requiredQuantity} obrigatório(s)</small></h3>${slots}<div class="combo-group-actions">${count<group.maxQuantity?`<button type="button" data-combo-quantity="1" data-group-id="${this.escape(group.id)}">+ Adicionar unidade</button>`:''}${count>group.requiredQuantity?`<button type="button" data-combo-quantity="-1" data-group-id="${this.escape(group.id)}">− Remover unidade</button>`:''}</div></section>`;
    }).join('');
    document.getElementById('customization-title').textContent=promotion.name;
    document.getElementById('customization-content').innerHTML=`<div class="customization-intro"><div><strong>${this.escape(promotion.description||promotion.name)}</strong><span>Preço fechado: ${this.money(Number(promotion.combo_price))}</span></div></div>${html}<p class="customization-help">Cada unidade pode ter opções próprias. O ERP confirma o estoque e recalcula o preço ao fechar o pedido.</p>`;
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
  beginAdd(id){if(!this.apiActive)return;const product=this.products.find(item=>item.id===id);if(!product||this.qty(id)>=this.stockLimit(product))return;const config=this.customizationConfig(product);if(!config){this.change(id,1,{});return}this.pendingCustomization={product,config};this.renderCustomization();const overlay=document.getElementById('customization-overlay');overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'},
  renderCustomization(){const pending=this.pendingCustomization;if(!pending)return;const {product,config}=pending;const saved=this.productOptions.get(product.id)||{};const groups=config.groups.map(group=>{const type=group.type||'radio';const selected=type==='checkbox'?(Array.isArray(saved[group.key])?saved[group.key]:[]):saved[group.key]||'';const options=group.options.map(([value,label])=>`<label class="customization-option"><input type="${type}" name="custom-${this.escape(group.key)}" value="${this.escape(value)}" ${type==='checkbox'?(selected.includes(value)?'checked':''):(selected===value?'checked':'')}><span>${this.escape(label)}</span></label>`).join('');return`<fieldset class="customization-group"><legend>${this.escape(group.label)} ${group.required?'<span class="customization-required">Obrigatório</span>':''}</legend><div class="customization-options">${options}</div></fieldset>`}).join('');document.getElementById('customization-title').textContent=product.name;document.getElementById('customization-content').innerHTML=`<div class="customization-intro"><img src="${this.escape(this.image(product.photo_url))}" alt="${this.escape(product.name)}" onerror="this.onerror=null;this.src='./assets/products/petiscos-referencia.jpg'"><div><strong>${this.escape(product.name)}</strong><span>${this.money(Number(product.sale_price))} · escolha como você prefere</span></div></div>${groups}<p class="customization-help">As opções escolhidas aparecem junto ao item no pedido.</p>`},
  readCustomization(){const pending=this.pendingCustomization;if(!pending)return null;const options={};for(const group of pending.config.groups){const type=group.type||'radio';const inputs=[...document.querySelectorAll(`input[name="custom-${group.key}"]`)];const selected=inputs.filter(input=>input.checked).map(input=>input.value);if(group.required&&!selected.length){this.toast(`Escolha: ${group.label}.`);return null}if(selected.length)options[group.key]=type==='checkbox'?selected:selected[0]}return options},
  confirmCustomization(){if(this.pendingCombo){const selections=this.readComboSelection();if(!selections)return;this.combos.set(crypto.randomUUID(),{promotion:this.pendingCombo,selections});this.pendingCombo=null;this.closeCustomization();if(this.coupon)this.clearCoupon('Carrinho alterado. Aplique o cupom novamente.');this.renderCart();if(typeof document.querySelector==='function')this.refreshQuote();return}const options=this.readCustomization();if(!options)return;const product=this.pendingCustomization.product;if(!Number.isFinite(this.productUnitPrice(product,options))){this.toast('Preço indisponível. Atualize o cardápio.');return}this.change(product.id,1,options);this.closeCustomization()},
  closeCustomization(){this.pendingCustomization=null;this.pendingCombo=null;const overlay=document.getElementById('customization-overlay');overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');document.body.style.overflow=''},
  cartProductId(key){return String(key).split('::')[0]},
  cartKey(productId,options={}){return `${productId}::${encodeURIComponent(JSON.stringify(options||{}))}`},
  qty(id){const direct=[...this.cart].reduce((total,[key,quantity])=>total+(this.cartProductId(key)===id?quantity:0),0);const combo=[...this.combos.values()].flatMap(combo=>combo.selections.flatMap(group=>group.items)).filter(item=>item.productId===id).reduce((sum,item)=>sum+item.quantity,0);return direct+combo},
  supportsFlavoredIce(id){return ['p-drk010','p-drk011'].includes(id)},
  change(id,delta,options){if(!this.apiActive)return;const productId=this.cartProductId(id),product=this.products.find(p=>p.id===productId);if(!product)return;let key;if(this.cart.has(id))key=id;else if(delta<0&&!options)key=[...this.cart.keys()].filter(item=>this.cartProductId(item)===productId).at(-1)||this.cartKey(productId,{});else key=this.cartKey(productId,options||{});const current=this.cart.get(key)||0,available=Math.max(0,this.stockLimit(product)-this.qty(productId)+current),qty=Math.max(0,Math.min(available,current+delta));if(qty){this.cart.set(key,qty);this.productOptions.set(key,options||this.productOptions.get(key)||{})}else{this.cart.delete(key);this.productOptions.delete(key)}if(this.coupon)this.clearCoupon('Carrinho alterado. Aplique o cupom novamente.');this.renderCatalog();this.renderCart();if(typeof document.querySelector==='function')this.refreshQuote()},
  categories(){const available=new Set(this.products.map(p=>this.categoryLabel(p.category)));return ['Todos',...this.categoryOrder.filter(c=>available.has(c)),...([...available].filter(c=>!this.categoryOrder.includes(c))) ]},
  renderCategories(){document.getElementById('category-list').innerHTML=this.categories().map(c=>`<button class="category-button ${c===this.category?'active':''}" data-category="${this.escape(c)}">${this.escape(c)}</button>`).join('')},
  renderCatalog(){
    if(!this.apiActive){document.getElementById('catalog').innerHTML='<div class="catalog-empty">Cardápio temporariamente indisponível.<br><button type="button" data-retry>Tentar novamente</button></div>';return}
    const list=this.products.filter(p=>this.categoryMatches(p,this.category)&&(`${p.name} ${p.description}`.toLowerCase().includes(this.search))).sort((a,b)=>{
      const rank=p=>this.categoryOrder.indexOf(this.categoryLabel(p.category));
      return (rank(a)<0?999:rank(a))-(rank(b)<0?999:rank(b));
    });
    document.getElementById('catalog').innerHTML=list.length?list.map(p=>{const q=this.qty(p.id),stock=this.stockLimit(p),unavailable=stock<=0;return `<article class="product-card ${q?'selected':''}"><img class="product-image" src="${this.escape(this.image(p.photo_url))}" alt="${this.escape(p.name)}" loading="lazy" onerror="this.onerror=null;this.src='./assets/products/snacks.jpg'"><div class="product-info"><span class="product-category">${this.escape(p.category)}</span><h2>${this.escape(p.name)}</h2><p class="product-description">${this.escape(p.description)}</p><div class="product-footer"><span class="product-price">${unavailable?'Indisponível':this.money(Number(p.sale_price))}</span><div class="qty-control" aria-label="Quantidade"><button data-action="dec" data-id="${this.escape(p.id)}" ${q?'':'disabled'} aria-label="Diminuir">−</button><output>${q}</output><button data-action="inc" data-id="${this.escape(p.id)}" ${unavailable||q>=stock?'disabled':''} aria-label="Adicionar">Adicionar</button></div></div></div></article>`}).join(''):'<div class="catalog-empty">Nenhum produto encontrado.</div>';
  },
  cartData(){return [...this.cart].map(([key,quantity])=>({key,product:this.products.find(p=>p.id===this.cartProductId(key)),quantity,options:this.productOptions.get(key)||{}})).filter(i=>i.product)},
  comboData(){return [...this.combos.values()]},
  comboLines(){return this.comboData().flatMap(combo=>combo.selections.flatMap(group=>group.items.map(item=>({...item,product:this.products.find(product=>product.id===item.productId),promotion:combo.promotion,groupId:group.groupId,groupName:combo.promotion.groups.find(groupInfo=>groupInfo.id===group.groupId)?.name}))))},
  allPromotionsPayload(){return this.comboData().map(combo=>({promotionId:combo.promotion.id,selections:combo.selections}))},
  cartPayloadItems(){return this.cartData().map(i=>({productId:i.product.id,quantity:i.quantity,expectedUnitPrice:this.productUnitPrice(i.product,i.options),options:i.options,flavoredIce:Boolean(i.options.flavoredIce)}))},
  subtotal(){const direct=this.cartData().reduce((s,i)=>s+this.productUnitPrice(i.product,i.options)*i.quantity,0);const combos=this.comboLines().reduce((sum,item)=>sum+(item.product?this.productUnitPrice(item.product,item.options)+Number(item.promotion.groups.find(group=>group.id===item.groupId)?.products.find(product=>product.id===item.productId)?.surcharge||0):0),0);return Math.round((direct+combos+Number.EPSILON)*100)/100},
  hasAlcohol(){return [...this.cartData().map(i=>i.product),...this.comboLines().map(i=>i.product).filter(Boolean)].some(product=>['Drinks','Cervejas'].includes(product.category))},
  renderCart(){
    const data=this.cartData(),comboLines=this.comboLines(),comboCount=this.comboData().reduce((sum,combo)=>sum+combo.selections.reduce((n,group)=>n+group.items.reduce((m,item)=>m+item.quantity,0),0),0),count=data.reduce((s,i)=>s+i.quantity,0)+comboCount,subtotal=this.subtotal();
    document.getElementById('cart-fab').classList.toggle('hidden',!count);document.getElementById('cart-count').textContent=count;document.getElementById('cart-fab-total').textContent=this.money(Math.max(0,subtotal-(this.quote?.promotionDiscount||0)-(this.coupon?.discount||0)));
    const direct=data.map(i=>`<div class="cart-item"><div><strong>${this.escape(i.product.name)}</strong><small>${i.quantity} × ${Number.isFinite(this.productUnitPrice(i.product,i.options))?this.money(this.productUnitPrice(i.product,i.options)):'Preço indisponível'}${this.optionSummary(i.options)}</small></div><div class="qty-control"><button data-action="dec" data-id="${this.escape(i.key)}">−</button><output>${i.quantity}</output><button data-action="inc" data-id="${this.escape(i.key)}">+</button></div></div>`);
    const comboCards=[...this.combos.entries()].map(([instanceId,combo])=>{const summary=combo.selections.flatMap(group=>group.items.map(item=>{const product=this.products.find(p=>p.id===item.productId);const groupName=combo.promotion.groups.find(p=>p.id===group.groupId)?.name;return `${groupName}: ${product?.name||item.productId}${this.optionSummary(item.options)}`})).map(value=>this.escape(value)).join('<br>');return `<div class="combo-cart-item"><div><strong class="combo-cart-title">${this.escape(combo.promotion.name)} · ${this.money(Number(combo.promotion.combo_price))}</strong><small>${summary}</small></div><button type="button" data-combo-remove="${this.escape(instanceId)}">Remover</button></div>`});
    document.getElementById('cart-items').innerHTML=[...comboCards,...direct].join('');
    this.renderCheckout();
  },
  renderCheckout(){const delivery=document.querySelector('[name="fulfillment"]:checked')?.value==='entrega',promoDiscount=this.quote?.promotionDiscount||0,discount=promoDiscount+(this.coupon?.discount||0),cartLines=[...this.cartData().map(i=>({product:i.product,quantity:i.quantity})),...this.comboLines().filter(i=>i.product).map(i=>({product:i.product,quantity:i.quantity}))],stockTotals=new Map();cartLines.forEach(i=>stockTotals.set(i.product.id,(stockTotals.get(i.product.id)||0)+i.quantity));const stockShort=[...stockTotals].some(([id,quantity])=>{const product=this.products.find(p=>p.id===id);return product&&this.stockLimit(product)<quantity}),priceMissing=!Number.isFinite(this.subtotal()),needsQuote=this.cart.size>0||this.combos.size>0,ready=this.apiActive&&this.storefront?.isOpen&&!stockShort&&!priceMissing&&!this.submitting&&(!needsQuote||!this.quoteBusy)&&(!needsQuote||this.quote!==null);document.getElementById('address-fields').classList.toggle('hidden',!delivery);document.querySelectorAll('[data-delivery-required]').forEach(field=>field.required=delivery);document.getElementById('delivery-row').classList.toggle('hidden',!delivery);document.getElementById('coupon-section').classList.toggle('hidden',!this.apiActive);document.getElementById('discount-row').classList.toggle('hidden',!discount);document.getElementById('checkout-discount').textContent=`- ${this.money(discount)}`;document.getElementById('adult-field').classList.toggle('hidden',!this.hasAlcohol());document.getElementById('checkout-subtotal').textContent=priceMissing?'Preço indisponível':this.money(this.quote?.subtotalNormal??this.subtotal());document.getElementById('checkout-total').textContent=priceMissing?'Preço indisponível':this.money(Math.max(0,(this.quote?.subtotalNormal??this.subtotal())+(delivery&&this.apiActive?this.deliveryFee:0)-discount));const btn=document.getElementById('checkout-button');btn.textContent='Confirmar pedido';btn.disabled=!ready;document.getElementById('checkout-help').textContent=!this.apiActive?'Cardápio indisponível. Aguarde a conexão com o ERP.':!this.storefront.isOpen?'A loja está fechada no momento.':this.quoteBusy?'Calculando promoções…':needsQuote&&!this.quote?`Não foi possível confirmar preço/promoção no ERP${this.quoteError?`: ${this.couponError(this.quoteError)}`:'. Atualize o carrinho.'}`:priceMissing?'O preço de uma opção mudou. Remova o item e escolha novamente.':stockShort?'O estoque de um item do carrinho mudou. Ajuste a quantidade.':this.storefront.allowOrdersWithoutStockForTesting?'MODO DE TESTES: este pedido será identificado como teste no ERP; o estoque real não será alterado.':delivery?'A taxa de entrega será confirmada pelo estabelecimento antes do pedido.':'O pedido será enviado ao estabelecimento para confirmação.'},
  async refreshQuote(){const sequence=++this.quoteSequence,items=this.cartPayloadItems(),combos=this.allPromotionsPayload();if(!items.length&&!combos.length){this.quote=null;this.quoteError=null;this.quoteBusy=false;this.renderCheckout();return}this.quoteBusy=true;this.quoteError=null;this.renderCheckout();try{const response=await fetch(this.endpoint('/public/pricing/quote'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,combos}),signal:AbortSignal.timeout(8000)});const body=await response.json();if(!response.ok)throw new Error(body.error);if(sequence!==this.quoteSequence)return;this.quote={subtotalNormal:body.data.subtotalNormal,promotionDiscount:body.data.promotions.reduce((sum,promo)=>sum+Number(promo.discount||0),0),promotions:body.data.promotions,rejectedPromotions:body.data.rejectedPromotions};this.renderCart()}catch(error){if(sequence===this.quoteSequence){this.quote=null;this.quoteError=error.message;this.renderCheckout()}}finally{if(sequence===this.quoteSequence){this.quoteBusy=false;this.renderCheckout()}}},
  clearCoupon(message=''){this.coupon=null;document.getElementById('coupon-status').textContent=message;this.renderCheckout()},
  couponError(code){return({coupon_already_used:'Este cupom já foi usado por este telefone.',first_order_only:'Este cupom é somente para o primeiro pedido deste telefone.',coupon_not_found:'Cupom inválido ou fora da validade.',coupon_not_combinable:'Este cupom não acumula com a promoção aplicada.',invalid_phone:'Digite um WhatsApp válido para aplicar o cupom.',product_unavailable:'Um produto do carrinho não está mais disponível.',product_options_required:'Escolha todas as opções obrigatórias do produto.',product_options_invalid:'Uma opção escolhida não é válida para este produto.',combo_group_required:'Escolha os componentes obrigatórios do combo.',combo_group_quantity:'Confira a quantidade escolhida em cada grupo.',combo_product_not_allowed:'Um produto escolhido não faz parte deste combo.',combo_options_not_allowed:'Uma opção escolhida não está disponível neste combo.',combo_price_exceeds_normal:'O preço do combo está acima do preço normal dos componentes.',promotion_not_started:'Esta promoção ainda não começou.',promotion_expired:'Esta promoção terminou.'})[code]||'Não foi possível validar o preço, a promoção ou o cupom.'},
  async applyCoupon(){const form=document.getElementById('checkout-form'),code=form.elements.couponCode.value.trim().toUpperCase(),phone=form.elements.phone.value.trim(),button=document.getElementById('coupon-apply');if(!code){this.toast('Digite o cupom.');return}if(!phone){this.toast('Digite seu WhatsApp antes de aplicar o cupom.');return}button.disabled=true;document.getElementById('coupon-status').textContent='Verificando…';try{const response=await fetch(this.endpoint('/public/coupons/validate'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,phone,items:this.cartPayloadItems(),combos:this.allPromotionsPayload()})});const body=await response.json();if(!response.ok)throw new Error(body.error);this.coupon=body.data;this.quote={subtotalNormal:body.data.subtotalNormal,promotionDiscount:body.data.promotionDiscount,promotions:body.data.promotions||[]};document.getElementById('coupon-status').textContent=`Cupom aplicado: ${body.data.description}.`;this.renderCart()}catch(error){this.coupon=null;if(error.message==='catalog_changed'){await this.refresh();document.getElementById('coupon-status').textContent='O preço mudou. Confira o carrinho e aplique novamente.'}else document.getElementById('coupon-status').textContent=this.couponError(error.message);this.renderCheckout()}finally{button.disabled=false}},
  openCart(open){document.getElementById('cart-overlay').classList.toggle('open',open);document.getElementById('cart-overlay').setAttribute('aria-hidden',String(!open));document.body.style.overflow=open?'hidden':''},
  productUnitPrice(product,options={}){let price=Number(product.sale_price);if(product.id==='p-drk001'&&['morango','maracuja'].includes(options.flavor))price=product.option_prices?.flavors?.[options.flavor]==null?NaN:Number(product.option_prices.flavors[options.flavor]);if(['p-pet001','p-pet002'].includes(product.id)&&options.size==='G')price=product.option_prices?.G==null?NaN:Number(product.option_prices.G);if(['p-drk010','p-drk011'].includes(product.id)&&options.size==='700ml')price=Number(product.option_prices?.['700ml']);if(product.id==='p-pet002'&&options.drink&&options.drink!=='none')price+=Number(product.option_prices?.drinks?.[options.drink]);if(product.id==='p-ref001'&&options.sodaFlavor)price=Number(product.option_prices?.soda?.[options.sodaFlavor]);return Number.isFinite(price)?Math.round((price+Number.EPSILON)*100)/100:NaN},
  optionSummary(options={}){const parts=[];if(options.flavor)parts.push(options.flavor==='maracuja'?'Maracujá':options.flavor==='natural'?'Limão':options.flavor[0].toUpperCase()+options.flavor.slice(1));if(options.sodaFlavor)parts.push({'coca-cola':'Coca-Cola',guarana:'Guaraná Antarctica',sprite:'Sprite'}[options.sodaFlavor]||options.sodaFlavor);if(Array.isArray(options.complement)&&options.complement.length)parts.push(`+ ${options.complement.join(', ')}`);if(options.size)parts.push(options.size);if(options.beverage)parts.push(options.beverage==='vodka'?'Vodka Smirnoff':'Whisky');if(options.iceFlavor)parts.push(`gelo de ${options.iceFlavor==='maracuja'?'maracujá':options.iceFlavor}`);if(options.drink&&options.drink!=='none')parts.push({'coca-cola':'Coca-Cola',guarana:'Guaraná',agua:'Água'}[options.drink]||options.drink);return parts.length?` · ${this.escape(parts.join(' · '))}`:''},
  payload(form){const data=new FormData(form),fulfillmentType=this.tableNumber?'retirada':data.get('fulfillment');return{customer:{name:data.get('name'),phone:data.get('phone')},fulfillmentType,tableNumber:this.tableNumber,address:{postalCode:data.get('postalCode')||'',city:data.get('city')||'',street:data.get('street')||'',number:data.get('number')||'',district:data.get('district')||'',complement:data.get('complement')||'',reference:data.get('reference')||''},paymentMethod:data.get('payment'),couponCode:this.coupon?.code||'',notes:data.get('notes')||'',adultConfirmed:data.get('adultConfirmed')==='on',website:data.get('website')||'',items:this.cartPayloadItems(),combos:this.allPromotionsPayload()}},
  async idempotencyKeyFor(payload){const bytes=new TextEncoder().encode(JSON.stringify(payload)),digest=await crypto.subtle.digest('SHA-256',bytes),hash=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join(''),storageKey='petisbar-pending-order';let saved=null;try{saved=JSON.parse(sessionStorage.getItem(storageKey)||'null')}catch{}if(saved?.hash===hash&&saved.key)return saved.key;const key=crypto.randomUUID();sessionStorage.setItem(storageKey,JSON.stringify({hash,key}));return key},
  validate(payload){if(!this.apiActive||!this.storefront)return'Cardápio indisponível. Tente novamente em instantes.';if(!this.storefront.isOpen)return'A loja está fechada no momento.';if(!payload.items.length&&!payload.combos.length)return'Adicione pelo menos um produto ou combo.';if(!Number.isFinite(this.subtotal()))return'O preço de uma opção mudou. Remova o item e escolha novamente.';if(this.quoteBusy||!this.quote)return'Aguarde o ERP confirmar as promoções e os preços.';const productCounts=new Map();[...this.cartData().map(i=>({product:i.product,quantity:i.quantity})),...this.comboLines().filter(i=>i.product).map(i=>({product:i.product,quantity:i.quantity}))].forEach(i=>productCounts.set(i.product.id,(productCounts.get(i.product.id)||0)+i.quantity));if([...productCounts].some(([id,quantity])=>this.stockLimit(this.products.find(p=>p.id===id))<quantity))return'O estoque de um item mudou. Ajuste a quantidade.';if(this.subtotal()<Number(this.storefront.minimumOrder ?? 20))return`O pedido mínimo é de ${this.money(Number(this.storefront.minimumOrder ?? 20))}.`;if(payload.fulfillmentType==='entrega'&&(!payload.address.postalCode||!payload.address.city||!payload.address.street||!payload.address.number||!payload.address.district))return'Preencha CEP, cidade, rua, número e bairro.';if(this.hasAlcohol()&&!payload.adultConfirmed)return'Confirme que você tem 18 anos ou mais.';return''},
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
      const response=await fetch(this.endpoint('/public/orders'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
      const body=await response.json().catch(()=>({}));
      if(!response.ok){
        if(['catalog_changed','product_unavailable','insufficient_stock','payment_unavailable','minimum_order_not_met'].includes(body.error)){
          await this.refresh();this.toast('O cardápio mudou. Confira preços, disponibilidade e pagamento antes de tentar novamente.');
        }else if(body.error==='store_closed'){
          await this.refresh();this.toast('A loja está fechada no momento.');
        }else this.toast(this.couponError(body.error));
        return;
      }
      this.cart.clear();this.productOptions.clear();this.flavoredIce.clear();this.combos.clear();this.coupon=null;this.quote=null;sessionStorage.removeItem('petisbar-pending-order');
      this.renderPromotions();this.renderCatalog();this.renderCart();this.openCart(false);
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
