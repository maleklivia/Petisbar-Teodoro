const Cardapio = {
  storeWhatsApp: '5521975816050',
  storefront: {minimumOrder:20,deliveryTime:'30–60 min',isOpen:true,hours:'Horários definidos no ERP',paymentMethods:['Pix','Dinheiro','Cartão na entrega'],promotions:[{title:'Promoções do dia',description:'Confira as promoções disponíveis no cardápio.'}]},
  apiActive: false, products: [], cart: new Map(), productOptions: new Map(), flavoredIce: new Map(), pendingCustomization: null, category: 'Todos', search: '', deliveryFee: 0, coupon: null, tableNumber: '',
  fallback: [
    ['p-drk001','Caipirinha Limão 500ml','Drinks','Cachaça 51, limão, açúcar e gelo',15.9,'caipirinha.jpg'],
    ['p-drk002','Caipirinha Morango 500ml','Drinks','Cachaça 51, morango, açúcar e gelo',16.9,'caipirinha-morango.jpg'],
    ['p-drk003','Caipirinha Maracujá 500ml','Drinks','Cachaça 51, maracujá, açúcar e gelo',17.9,'caipirinha-maracuja.jpg'],
    ['p-drk004','Caipivodka Limão 500ml','Drinks','Vodka Smirnoff, limão, açúcar e gelo',19.9,'caipirinha.jpg'],
    ['p-drk005','Caipivodka Morango 500ml','Drinks','Vodka Smirnoff, morango, açúcar e gelo',20.9,'caipirinha.jpg'],
    ['p-drk006','Caipivodka Maracujá 500ml','Drinks','Vodka Smirnoff, maracujá, açúcar e gelo',21.9,'caipirinha.jpg'],
    ['p-drk010','Copão','Drinks','Copão personalizável de 500ml ou 700ml com vodka ou whisky, energético e gelo saborizado',19.9,'energy-cocktail.jpg'],
    ['p-bee001','Brahma Lata 350ml','Cervejas','Cerveja Brahma lata 350ml',6,'beer.jpg'],
    ['p-bee002','Skol Lata 350ml','Cervejas','Cerveja Skol lata 350ml',6,'beer.jpg'],
    ['p-bee003','Corona 355ml','Cervejas','Cerveja Corona garrafa 355ml',12,'beer.jpg'],
    ['p-bee004','Heineken 330ml','Cervejas','Cerveja Heineken 330ml',10,'beer.jpg'],
    ['p-bee005','Budweiser 350ml','Cervejas','Cerveja Budweiser lata 350ml',8,'beer.jpg'],
    ['p-bee006','Artesanal 600ml','Cervejas','Cerveja artesanal local 600ml',18,'beer.jpg'],
    ['p-ref001','Refrigerante lata','Refrigerantes','Escolha Coca-Cola, Guaraná Antarctica ou Sprite (350ml)',5,'soda.jpg'],
    ['p-ref004','Schweppes Tônica 350ml','Refrigerantes','Água tônica lata 350ml',5.5,'soda.jpg'],
    ['p-agu001','Água Mineral 500ml','Águas','Água mineral sem gás',3,'water.jpg'],
    ['p-agu002','Água com Gás 500ml','Águas','Água mineral com gás',4,'water.jpg'],
    ['p-ene001','Red Bull 250ml','Energéticos','Red Bull lata 250ml',12,'energy-drink.jpg'],
    ['p-ene002','Monster Energy 473ml','Energéticos','Monster Energy lata 473ml',12,'energy-drink.jpg'],
    ['p-aca001','Batidinha de Açaí 300ml','Açaí','Açaí batido em garrafinha de 300ml',15,'acai-joy.png'],
    ['p-pet001','Batata Frita P — 300g','Petiscos','Porção individual com 300g de batata frita sequinha e crocante',17.9,'petiscos-referencia.jpg'],
    ['p-pet006','Batata Frita G — 500g','Petiscos','Porção grande com 500g de batata frita, ideal para compartilhar',24.9,'petiscos-referencia.jpg'],
    ['p-pet002','Batata com Cheddar e Bacon','Petiscos','Batata com cheddar e bacon em tamanho P ou G, com opção de adicionar bebida',27.9,'petiscos-referencia.jpg'],
    ['p-pet003','Calabresa Frita','Petiscos','Porção de calabresa frita acebolada',36.9,'petiscos-referencia.jpg'],
    ['p-pet004','Frango a Passarinho','Petiscos','Frango a passarinho temperado e frito na hora',44.9,'petiscos-referencia.jpg'],
    ['p-pet005','Isca de Carne','Petiscos','Iscas de carne fritas para compartilhar',49.9,'petiscos-referencia.jpg'],
    ['p-br001','Batata de Frango Cremoso — 400g','BATATAS RECHEADAS','Purê de batata cremoso, frango temperado, requeijão e muçarela gratinada.',27.9,'batatas-recheadas-referencia.jpg'],
    ['p-br002','Batata de Calabresa Acebolada — 400g','BATATAS RECHEADAS','Purê de batata cremoso, calabresa acebolada, requeijão e muçarela gratinada.',27.9,'batatas-recheadas-referencia.jpg'],
    ['p-br003','Batata Bacon & Cheddar — 400g','BATATAS RECHEADAS','Purê de batata cremoso, bacon crocante, cheddar cremoso e muçarela gratinada.',29.9,'batatas-recheadas-referencia.jpg'],
    ['p-br004','Batata Strogonoff de Frango — 400g','BATATAS RECHEADAS','Purê de batata cremoso com strogonoff de frango, muçarela gratinada e batata palha.',29.9,'batatas-recheadas-referencia.jpg'],
    ['p-br005','Batata de Carne Seca Cremosa — 400g','BATATAS RECHEADAS','Purê de batata cremoso, carne seca desfiada, requeijão e muçarela gratinada.',34.9,'batatas-recheadas-referencia.jpg'],
    ['p-con002','Mix de Nuts 100g','Conveniência','Mix de castanhas e nozes',12,'snacks.jpg'],
    ['p-con003','Batata Chips 60g','Conveniência','Batata chips sabor original',8,'snacks.jpg'],
    ['p-con004','Azeitona Temperada 100g','Conveniência','Azeitona verde temperada',10,'snacks.jpg'],
  ].map(([id,name,category,description,price,image])=>({id,name,category,description,sale_price:price,photo_url:`./assets/products/${image}`})),

  money(value){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value)},
  escape(value){const el=document.createElement('div');el.textContent=String(value??'');return el.innerHTML},
  image(url){if(!url)return './assets/products/petiscos-referencia.jpg';return url.replace(/^\.\.\//,'./')},
  productPhoto(product){
    const id=product.id;
    if(id==='p-aca001') return './assets/products/acai-joy.png';
    if(['p-br001','p-br002','p-br003','p-br004','p-br005'].includes(id)) return './assets/products/batatas-recheadas-referencia.jpg';
    if(['p-pet001','p-pet002','p-pet003','p-pet004','p-pet005','p-pet006','p-pet007'].includes(id)) return './assets/products/petiscos-referencia.jpg';
    if(['p-drk002','p-drk005'].includes(id)) return './assets/products/caipirinha-morango.jpg';
    if(['p-drk003','p-drk006'].includes(id)) return './assets/products/caipirinha-maracuja.jpg';
    if(['p-drk010','p-drk011'].includes(id)) return './assets/products/energy-cocktail.jpg';
    return product.photo_url || './assets/products/snacks.jpg';
  },
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
        const [storefront,products]=await Promise.all([this.fetchPublic('/public/storefront'),this.fetchPublic('/public/catalog')]);
        if(!storefront||!Array.isArray(products))throw new Error('invalid_catalog');
        const previous=new Map(this.products.map(p=>[p.id,JSON.stringify([p.name,p.category,p.description,p.sale_price,p.photo_url,p.current_stock])]));
        this.storefront=storefront;
        this.products=products;
        this.apiActive=true;
        if([...this.cart.keys()].some(id=>!products.some(p=>p.id===id))){
          for(const id of this.cart.keys())if(!products.some(p=>p.id===id)){this.cart.delete(id);this.flavoredIce.delete(id)}
          this.toast('Produto indisponível removido do carrinho.');
        }
        if(this.coupon&&products.some(p=>previous.get(p.id)!==JSON.stringify([p.name,p.category,p.description,p.sale_price,p.photo_url,p.current_stock])))this.coupon=null;
        this.renderStorefront();
        const notice=document.getElementById('service-notice');
        notice.classList.toggle('hidden',!this.tableNumber);
        if(this.tableNumber)notice.textContent=`Pedido para consumo na Mesa ${this.tableNumber}.`;
      }catch{
        this.apiActive=false;
        this.products=[];
        this.storefront=null;
        this.coupon=null;
        this.openCart(false);
        const notice=document.getElementById('service-notice');
        notice.classList.remove('hidden');
        notice.textContent='Cardápio temporariamente indisponível. Não é possível fazer pedidos até a conexão com o ERP voltar.';
        const status=document.getElementById('store-status');
        status.classList.remove('open');status.classList.add('closed');status.querySelector('strong').textContent='Cardápio indisponível';
        for(const id of ['minimum-order','delivery-time','payment-summary','opening-hours'])document.getElementById(id).textContent='Indisponível';
      }
      this.renderCategories();this.renderCatalog();this.renderCart();
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
  localCatalog(){
    try {
      const raw = localStorage.getItem('distrito-produtos-v3');
      if (!raw) return null;
      const products = JSON.parse(raw);
      if (!Array.isArray(products)) return null;
      return products.filter(p => p && p.ativo !== false).map(p => ({
        id: p.id,
        name: p.nome,
        category: p.categoria,
        description: p.descricao || '',
        sale_price: Number(p.precoVenda) || 0,
        photo_url: this.productPhoto({id:p.id, photo_url:p.foto}),
      }));
    } catch {
      return null;
    }
  },
  categoryOrder: ['BATATAS RECHEADAS','Petiscos','Açaí','Drinks','Cervejas','Bebidas','Conveniência'],
  categoryLabel(category){return ['Refrigerantes','Águas','Energéticos'].includes(category)?'Bebidas':category},
  categoryMatches(product, category){return category==='Todos'||this.categoryLabel(product.category)===category},
  presentation(product){return product},
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
    document.getElementById('catalog').addEventListener('change',e=>{if(e.target.matches('[data-flavored-ice]')){this.flavoredIce.set(e.target.dataset.flavoredIce,e.target.checked);if(this.coupon)this.clearCoupon('Opção alterada. Aplique o cupom novamente.');this.renderCart()}});
    document.getElementById('cart-items').addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(button)this.change(button.dataset.id,button.dataset.action==='inc'?1:-1)});
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
    if(id==='p-ref001')return{groups:[{key:'sodaFlavor',label:'Escolha o refrigerante',required:true,options:[['coca-cola','Coca-Cola 350ml'],['guarana','Guaraná Antarctica 350ml'],['sprite','Sprite 350ml']]}]};
    if(['p-drk001','p-drk002','p-drk003','p-drk004','p-drk005','p-drk006'].includes(id))return{groups:[{key:'flavor',label:'Escolha o sabor',required:true,options:flavors}]};
    if(['p-drk010','p-drk011'].includes(id))return{groups:[{key:'size',label:'Escolha o tamanho',required:true,options:[['500ml','500 ml'],['700ml','700 ml']]},{key:'beverage',label:'Escolha a bebida',required:true,options:[['vodka','Vodka Smirnoff'],['whisky','Whisky']]},{key:'iceFlavor',label:'Escolha o sabor do gelo',required:true,options:[['coco','Coco'],['maracuja','Maracujá']]}]};
    if(id==='p-pet002')return{groups:[{key:'size',label:'Escolha o tamanho',required:true,options:[['P','P — 400g'],['G','G — 700g']]},{key:'drink',label:'Adicionar uma bebida',options:[['none','Sem bebida'],['coca-cola','Coca-Cola 350ml (+ R$ 6,00)'],['guarana','Guaraná Antarctica 350ml (+ R$ 5,00)'],['agua','Água mineral 500ml (+ R$ 3,00)']]}]};
    if(['p-pet001','p-pet006','p-pet007'].includes(id))return{groups:[{key:'size',label:'Escolha o tamanho',required:true,options:[['P','P'],['G','G']]}]};
    return null;
  },
  beginAdd(id){const product=this.products.find(item=>item.id===id);if(!product)return;const config=this.customizationConfig(product);if(!config){this.change(id,1,{});return}this.pendingCustomization={product,config};this.renderCustomization();const overlay=document.getElementById('customization-overlay');overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');document.body.style.overflow='hidden'},
  renderCustomization(){const pending=this.pendingCustomization;if(!pending)return;const {product,config}=pending;const saved=this.productOptions.get(product.id)||{};const groups=config.groups.map(group=>{const type=group.type||'radio';const selected=type==='checkbox'?(Array.isArray(saved[group.key])?saved[group.key]:[]):saved[group.key]||'';const options=group.options.map(([value,label])=>`<label class="customization-option"><input type="${type}" name="custom-${this.escape(group.key)}" value="${this.escape(value)}" ${type==='checkbox'?(selected.includes(value)?'checked':''):(selected===value?'checked':'')}><span>${this.escape(label)}</span></label>`).join('');return`<fieldset class="customization-group"><legend>${this.escape(group.label)} ${group.required?'<span class="customization-required">Obrigatório</span>':''}</legend><div class="customization-options">${options}</div></fieldset>`}).join('');document.getElementById('customization-title').textContent=product.name;document.getElementById('customization-content').innerHTML=`<div class="customization-intro"><img src="${this.escape(this.image(product.photo_url))}" alt="${this.escape(product.name)}" onerror="this.onerror=null;this.src='./assets/products/petiscos-referencia.jpg'"><div><strong>${this.escape(product.name)}</strong><span>${this.money(Number(product.sale_price))} · escolha como você prefere</span></div></div>${groups}<p class="customization-help">As opções escolhidas aparecem junto ao item no pedido.</p>`},
  readCustomization(){const pending=this.pendingCustomization;if(!pending)return null;const options={};for(const group of pending.config.groups){const type=group.type||'radio';const inputs=[...document.querySelectorAll(`input[name="custom-${group.key}"]`)];const selected=inputs.filter(input=>input.checked).map(input=>input.value);if(group.required&&!selected.length){this.toast(`Escolha: ${group.label}.`);return null}if(selected.length)options[group.key]=type==='checkbox'?selected:selected[0]}return options},
  confirmCustomization(){const options=this.readCustomization();if(!options)return;const id=this.pendingCustomization.product.id;this.change(id,1,options);this.closeCustomization()},
  closeCustomization(){this.pendingCustomization=null;const overlay=document.getElementById('customization-overlay');overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');document.body.style.overflow=''},
  qty(id){return this.cart.get(id)||0},
  supportsFlavoredIce(id){return ['p-drk010','p-drk011'].includes(id)},
  change(id,delta,options){const qty=Math.max(0,this.qty(id)+delta);if(qty){this.cart.set(id,qty);if(options&&Object.keys(options).length)this.productOptions.set(id,options)}else{this.cart.delete(id);this.productOptions.delete(id);this.flavoredIce.delete(id)}if(this.coupon)this.clearCoupon('Carrinho alterado. Aplique o cupom novamente.');this.renderCatalog();this.renderCart()},
  categories(){const available=new Set(this.products.map(p=>this.categoryLabel(p.category)));return ['Todos',...this.categoryOrder.filter(c=>available.has(c)),...([...available].filter(c=>!this.categoryOrder.includes(c))) ]},
  renderCategories(){document.getElementById('category-list').innerHTML=this.categories().map(c=>`<button class="category-button ${c===this.category?'active':''}" data-category="${this.escape(c)}">${this.escape(c)}</button>`).join('')},
  renderCatalog(){
    if(!this.apiActive){document.getElementById('catalog').innerHTML='<div class="catalog-empty">Cardápio temporariamente indisponível.<br><button type="button" data-retry>Tentar novamente</button></div>';return}
    const list=this.products.map(p=>this.presentation(p)).filter(p=>this.categoryMatches(p,this.category)&&(`${p.name} ${p.description}`.toLowerCase().includes(this.search))).sort((a,b)=>{
      const rank=p=>this.categoryOrder.indexOf(this.categoryLabel(p.category));
      return (rank(a)<0?999:rank(a))-(rank(b)<0?999:rank(b));
    });
    document.getElementById('catalog').innerHTML=list.length?list.map(p=>{const q=this.qty(p.id),stock=p.current_stock==null?Infinity:Number(p.current_stock),unavailable=stock<=0;return `<article class="product-card ${q?'selected':''}"><img class="product-image" src="${this.escape(this.image(p.photo_url))}" alt="${this.escape(p.name)}" loading="lazy" onerror="this.onerror=null;this.src='./assets/products/petiscos-referencia.jpg'"><div class="product-info"><span class="product-category">${this.escape(p.category)}</span><h2>${this.escape(p.name)}</h2><p class="product-description">${this.escape(p.description)}</p><div class="product-footer"><span class="product-price">${unavailable?'Indisponível':this.money(Number(p.sale_price))}</span><div class="qty-control" aria-label="Quantidade"><button data-action="dec" data-id="${this.escape(p.id)}" ${q?'':'disabled'} aria-label="Diminuir">−</button><output>${q}</output><button data-action="inc" data-id="${this.escape(p.id)}" ${unavailable||q>=stock?'disabled':''} aria-label="Adicionar">Adicionar</button></div></div></div></article>`}).join(''):'<div class="catalog-empty">Nenhum produto encontrado.</div>';
  },
  cartData(){return [...this.cart].map(([id,quantity])=>({product:this.products.find(p=>p.id===id),quantity,options:this.productOptions.get(id)||{}})).filter(i=>i.product)},
  subtotal(){return this.cartData().reduce((s,i)=>s+this.productUnitPrice(i.product,i.options)*i.quantity,0)},
  hasAlcohol(){return this.cartData().some(i=>['Drinks','Cervejas'].includes(i.product.category))},
  renderCart(){
    const data=this.cartData(),count=data.reduce((s,i)=>s+i.quantity,0),subtotal=this.subtotal();
    document.getElementById('cart-fab').classList.toggle('hidden',!count);document.getElementById('cart-count').textContent=count;document.getElementById('cart-fab-total').textContent=this.money(subtotal);
    document.getElementById('cart-items').innerHTML=data.map(i=>`<div class="cart-item"><div><strong>${this.escape(i.product.name)}</strong><small>${i.quantity} × ${this.money(this.productUnitPrice(i.product,i.options))}${this.optionSummary(i.options)}</small></div><div class="qty-control"><button data-action="dec" data-id="${this.escape(i.product.id)}">−</button><output>${i.quantity}</output><button data-action="inc" data-id="${this.escape(i.product.id)}">+</button></div></div>`).join('');
    this.renderCheckout();
  },
  renderCheckout(){const delivery=document.querySelector('[name="fulfillment"]:checked')?.value==='entrega',discount=this.coupon?.discount||0;document.getElementById('address-fields').classList.toggle('hidden',!delivery);document.querySelectorAll('[data-delivery-required]').forEach(field=>field.required=delivery);document.getElementById('delivery-row').classList.toggle('hidden',!delivery);document.getElementById('coupon-section').classList.toggle('hidden',!this.apiActive);document.getElementById('discount-row').classList.toggle('hidden',!discount);document.getElementById('checkout-discount').textContent=`- ${this.money(discount)}`;document.getElementById('adult-field').classList.toggle('hidden',!this.hasAlcohol());document.getElementById('checkout-subtotal').textContent=this.money(this.subtotal());document.getElementById('checkout-total').textContent=this.money(Math.max(0,this.subtotal()+(delivery&&this.apiActive?this.deliveryFee:0)-discount));const btn=document.getElementById('checkout-button');btn.textContent=this.apiActive?'Confirmar pedido':'Preparar pedido';document.getElementById('checkout-help').textContent=delivery?'O total exibido é somente dos produtos; a taxa de entrega será confirmada pelo estabelecimento antes do pedido.':'O pedido será enviado ao estabelecimento para confirmação.'},
  clearCoupon(message=''){this.coupon=null;document.getElementById('coupon-status').textContent=message;this.renderCheckout()},
  couponError(code){return({coupon_already_used:'Este cupom já foi usado por este telefone.',first_order_only:'Este cupom é somente para o primeiro pedido deste telefone.',coupon_not_found:'Cupom inválido ou fora da validade.',invalid_phone:'Digite um WhatsApp válido para aplicar o cupom.',product_unavailable:'Um produto do carrinho não está mais disponível.'})[code]||'Não foi possível aplicar o cupom.'},
  async applyCoupon(){const form=document.getElementById('checkout-form'),code=form.elements.couponCode.value.trim().toUpperCase(),phone=form.elements.phone.value.trim(),button=document.getElementById('coupon-apply');if(!code){this.toast('Digite o cupom.');return}if(!phone){this.toast('Digite seu WhatsApp antes de aplicar o cupom.');return}button.disabled=true;document.getElementById('coupon-status').textContent='Verificando…';try{const response=await fetch(this.endpoint('/public/coupons/validate'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,phone,items:this.cartData().map(i=>({productId:i.product.id,quantity:i.quantity,expectedUnitPrice:this.productUnitPrice(i.product,i.options),options:i.options}))})});const body=await response.json();if(!response.ok)throw new Error(body.error);this.coupon=body.data;document.getElementById('coupon-status').textContent=`Cupom aplicado: ${body.data.description}.`;this.renderCheckout()}catch(error){this.coupon=null;document.getElementById('coupon-status').textContent=this.couponError(error.message);this.renderCheckout()}finally{button.disabled=false}},
  openCart(open){document.getElementById('cart-overlay').classList.toggle('open',open);document.getElementById('cart-overlay').setAttribute('aria-hidden',String(!open));document.body.style.overflow=open?'hidden':''},
  productUnitPrice(product,options={}){let price=Number(product.sale_price);if(product.id==='p-pet002'&&options.size==='G')price=39.90;if(['p-drk010','p-drk011'].includes(product.id)&&options.size==='700ml')price=24.90;if(product.id==='p-pet002')price+=({'coca-cola':6,guarana:5,agua:3}[options.drink]||0);if(product.id==='p-ref001'&&options.sodaFlavor==='coca-cola')price=6.00;return price},
  optionSummary(options={}){const parts=[];if(options.flavor)parts.push(options.flavor==='maracuja'?'Maracujá':options.flavor[0].toUpperCase()+options.flavor.slice(1));if(options.sodaFlavor)parts.push({'coca-cola':'Coca-Cola','guarana':'Guaraná Antarctica',sprite:'Sprite'}[options.sodaFlavor]||options.sodaFlavor);if(Array.isArray(options.complement)&&options.complement.length)parts.push(`+ ${options.complement.join(', ')}`);if(options.size)parts.push(options.size);if(options.beverage)parts.push(options.beverage==='vodka'?'Vodka Smirnoff':'Whisky');if(options.iceFlavor)parts.push(`gelo de ${options.iceFlavor==='maracuja'?'maracujá':options.iceFlavor}`);if(options.drink&&options.drink!=='none')parts.push({'coca-cola':'Coca-Cola',guarana:'Guaraná',agua:'Água'}[options.drink]||options.drink);return parts.length?` · ${this.escape(parts.join(' · '))}`:''},
  payload(form){const data=new FormData(form),fulfillmentType=this.tableNumber?'retirada':data.get('fulfillment');return{customer:{name:data.get('name'),phone:data.get('phone')},fulfillmentType,tableNumber:this.tableNumber,address:{postalCode:data.get('postalCode')||'',city:data.get('city')||'',street:data.get('street')||'',number:data.get('number')||'',district:data.get('district')||'',complement:data.get('complement')||'',reference:data.get('reference')||''},paymentMethod:data.get('payment'),couponCode:this.coupon?.code||'',notes:data.get('notes')||'',adultConfirmed:data.get('adultConfirmed')==='on',website:data.get('website')||'',items:this.cartData().map(i=>({productId:i.product.id,quantity:i.quantity,expectedUnitPrice:this.productUnitPrice(i.product,i.options),options:i.options,flavoredIce:this.supportsFlavoredIce(i.product.id)&&(this.flavoredIce.get(i.product.id)||false)}))}},
  validate(payload){if(!payload.items.length)return'Adicione pelo menos um produto.';if(this.subtotal()<Number(this.storefront.minimumOrder||20))return`O pedido mínimo é de ${this.money(Number(this.storefront.minimumOrder||20))}.`;if(payload.fulfillmentType==='entrega'&&(!payload.address.postalCode||!payload.address.city||!payload.address.street||!payload.address.number||!payload.address.district))return'Preencha CEP, cidade, rua, número e bairro.';if(this.hasAlcohol()&&!payload.adultConfirmed)return'Confirme que você tem 18 anos ou mais.';return''},
  message(payload){const receipt=payload.tableNumber?`Consumo na Mesa ${payload.tableNumber}`:(payload.fulfillmentType==='entrega'?'Entrega':'Retirada');const lines=['*NOVO PEDIDO — PETISBAR TEODORO*','',...this.cartData().map(i=>`• ${i.quantity}x ${i.product.name}${this.optionSummary(i.options)} — ${this.money(this.productUnitPrice(i.product,i.options)*i.quantity)}`),'',`*Subtotal:* ${this.money(this.subtotal())}`,`*Recebimento:* ${receipt}`,`*Pagamento:* ${payload.paymentMethod}`,`*Cliente:* ${payload.customer.name}`,`*Telefone:* ${payload.customer.phone}`];if(payload.fulfillmentType==='entrega'){lines.push('', '*ENDEREÇO DE ENTREGA*',`${payload.address.street}, ${payload.address.number}`,`${payload.address.district} — ${payload.address.city}`,`CEP: ${payload.address.postalCode}`);if(payload.address.complement)lines.push(`Complemento: ${payload.address.complement}`);if(payload.address.reference)lines.push(`Referência: ${payload.address.reference}`)}if(payload.notes)lines.push(`*Observações:* ${payload.notes}`);lines.push('','Aguardando confirmação do estabelecimento.');return lines.join('\n')},
  async submit(event){event.preventDefault();const form=event.currentTarget,payload=this.payload(form),error=this.validate(payload);if(error){this.toast(error);return}const button=document.getElementById('checkout-button');button.disabled=true;
    if(this.apiActive){try{const response=await fetch(this.endpoint('/public/orders'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const body=await response.json();if(!response.ok)throw new Error(body.error);this.cart.clear();this.flavoredIce.clear();this.coupon=null;this.renderCatalog();this.renderCart();this.openCart(false);this.toast(`Pedido #${body.data.orderNumber} recebido!`);form.reset();return}catch(error){button.disabled=false;if(['coupon_already_used','first_order_only','coupon_not_found','invalid_phone'].includes(error.message)){this.coupon=null;document.getElementById('coupon-status').textContent=this.couponError(error.message);this.renderCheckout();this.toast(this.couponError(error.message));return}this.toast('O servidor não respondeu. Tente novamente.');return}}
    const whatsappUrl=`https://api.whatsapp.com/send/?phone=${this.storeWhatsApp}&text=${encodeURIComponent(this.message(payload))}&type=phone_number&app_absent=0`;
    window.location.assign(whatsappUrl);button.disabled=false;
  },
  toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.classList.remove('show'),3500)},
};
document.addEventListener('DOMContentLoaded',()=>Cardapio.init());
