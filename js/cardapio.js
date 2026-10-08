const Cardapio = {
  storefront: null,
  apiActive: false, products: [], cart: new Map(), flavoredIce: new Map(), category: 'Todos', search: '', deliveryFee: 0, coupon: null, tableNumber: '', refreshPromise: null, submitting: false,
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
    document.getElementById('catalog').addEventListener('click',e=>{if(e.target.closest('[data-retry]')){this.refresh();return}const button=e.target.closest('[data-action]');if(button)this.change(button.dataset.id,button.dataset.action==='inc'?1:-1)});
    document.getElementById('catalog').addEventListener('change',e=>{if(e.target.matches('[data-flavored-ice]')){this.flavoredIce.set(e.target.dataset.flavoredIce,e.target.checked);if(this.coupon)this.clearCoupon('Opção alterada. Aplique o cupom novamente.');this.renderCart()}});
    document.getElementById('cart-items').addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(button)this.change(button.dataset.id,button.dataset.action==='inc'?1:-1)});
    document.getElementById('cart-fab').addEventListener('click',()=>this.openCart(true));document.getElementById('cart-close').addEventListener('click',()=>this.openCart(false));
    document.getElementById('cart-overlay').addEventListener('click',e=>{if(e.target.id==='cart-overlay')this.openCart(false)});
    document.querySelectorAll('[name="fulfillment"]').forEach(input=>input.addEventListener('change',()=>this.renderCheckout()));
    document.getElementById('coupon-apply').addEventListener('click',()=>this.applyCoupon());
    document.getElementById('coupon-code').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase();if(this.coupon&&e.target.value!==this.coupon.code)this.clearCoupon('Aplique o cupom novamente.')});
    document.getElementById('checkout-form').addEventListener('submit',e=>this.submit(e));
  },
  qty(id){return this.cart.get(id)||0},
  supportsFlavoredIce(id){return ['p-drk010','p-drk011'].includes(id)},
  change(id,delta){if(!this.apiActive)return;const product=this.products.find(p=>p.id===id);if(!product)return;const stock=product.current_stock==null?Infinity:Number(product.current_stock);const qty=Math.max(0,Math.min(stock,this.qty(id)+delta));if(qty)this.cart.set(id,qty);else{this.cart.delete(id);this.flavoredIce.delete(id)}if(this.coupon)this.clearCoupon('Carrinho alterado. Aplique o cupom novamente.');this.renderCatalog();this.renderCart()},
  categories(){const available=new Set(this.products.map(p=>this.categoryLabel(p.category)));return ['Todos',...this.categoryOrder.filter(c=>available.has(c)),...([...available].filter(c=>!this.categoryOrder.includes(c))) ]},
  renderCategories(){document.getElementById('category-list').innerHTML=this.categories().map(c=>`<button class="category-button ${c===this.category?'active':''}" data-category="${this.escape(c)}">${this.escape(c)}</button>`).join('')},
  renderCatalog(){
    if(!this.apiActive){document.getElementById('catalog').innerHTML='<div class="catalog-empty">Cardápio temporariamente indisponível.<br><button type="button" data-retry>Tentar novamente</button></div>';return}
    const list=this.products.filter(p=>this.categoryMatches(p,this.category)&&(`${p.name} ${p.description}`.toLowerCase().includes(this.search))).sort((a,b)=>{
      const rank=p=>this.categoryOrder.indexOf(this.categoryLabel(p.category));
      return (rank(a)<0?999:rank(a))-(rank(b)<0?999:rank(b));
    });
    document.getElementById('catalog').innerHTML=list.length?list.map(p=>{const q=this.qty(p.id),ice=this.flavoredIce.get(p.id)||false,stock=p.current_stock==null?Infinity:Number(p.current_stock),unavailable=stock<=0,option=this.supportsFlavoredIce(p.id)&&!unavailable?`<label class="product-option"><input type="checkbox" data-flavored-ice="${this.escape(p.id)}" ${ice?'checked':''}> Gelo saborizado — preço a confirmar</label>`:'';return `<article class="product-card ${q?'selected':''}"><img class="product-image" src="${this.escape(this.image(p.photo_url))}" alt="${this.escape(p.name)}" loading="lazy"><div class="product-info"><span class="product-category">${this.escape(p.category)}</span><h2>${this.escape(p.name)}</h2><p class="product-description">${this.escape(p.description)}</p>${option}<div class="product-footer"><span class="product-price">${unavailable?'Indisponível':this.money(Number(p.sale_price))}</span><div class="qty-control" aria-label="Quantidade"><button data-action="dec" data-id="${this.escape(p.id)}" ${q?'':'disabled'} aria-label="Diminuir">−</button><output>${q}</output><button data-action="inc" data-id="${this.escape(p.id)}" ${unavailable||q>=stock?'disabled':''} aria-label="Adicionar">Adicionar</button></div></div></div></article>`}).join(''):'<div class="catalog-empty">Nenhum produto encontrado.</div>';
  },
  cartData(){return [...this.cart].map(([id,quantity])=>({product:this.products.find(p=>p.id===id),quantity})).filter(i=>i.product)},
  subtotal(){return this.cartData().reduce((s,i)=>s+Number(i.product.sale_price)*i.quantity,0)},
  hasAlcohol(){return this.cartData().some(i=>['Drinks','Cervejas'].includes(i.product.category))},
  renderCart(){
    const data=this.cartData(),count=data.reduce((s,i)=>s+i.quantity,0),subtotal=this.subtotal();
    document.getElementById('cart-fab').classList.toggle('hidden',!count);document.getElementById('cart-count').textContent=count;document.getElementById('cart-fab-total').textContent=this.money(subtotal);
    document.getElementById('cart-items').innerHTML=data.map(i=>`<div class="cart-item"><div><strong>${this.escape(i.product.name)}</strong><small>${i.quantity} × ${this.money(Number(i.product.sale_price))}${this.flavoredIce.get(i.product.id)?' · Com gelo saborizado':''}</small></div><div class="qty-control"><button data-action="dec" data-id="${this.escape(i.product.id)}">−</button><output>${i.quantity}</output><button data-action="inc" data-id="${this.escape(i.product.id)}">+</button></div></div>`).join('');
    this.renderCheckout();
  },
  renderCheckout(){const delivery=document.querySelector('[name="fulfillment"]:checked')?.value==='entrega',discount=this.coupon?.discount||0,stockShort=this.cartData().some(i=>i.product.current_stock!=null&&Number(i.product.current_stock)<i.quantity),ready=this.apiActive&&this.storefront?.isOpen&&!stockShort&&!this.submitting;document.getElementById('address-fields').classList.toggle('hidden',!delivery);document.querySelectorAll('[data-delivery-required]').forEach(field=>field.required=delivery);document.getElementById('delivery-row').classList.toggle('hidden',!delivery);document.getElementById('coupon-section').classList.toggle('hidden',!this.apiActive);document.getElementById('discount-row').classList.toggle('hidden',!discount);document.getElementById('checkout-discount').textContent=`- ${this.money(discount)}`;document.getElementById('adult-field').classList.toggle('hidden',!this.hasAlcohol());document.getElementById('checkout-subtotal').textContent=this.money(this.subtotal());document.getElementById('checkout-total').textContent=this.money(Math.max(0,this.subtotal()+(delivery&&this.apiActive?this.deliveryFee:0)-discount));const btn=document.getElementById('checkout-button');btn.textContent='Confirmar pedido';btn.disabled=!ready;document.getElementById('checkout-help').textContent=!this.apiActive?'Cardápio indisponível. Aguarde a conexão com o ERP.':!this.storefront.isOpen?'A loja está fechada no momento.':stockShort?'O estoque de um item do carrinho mudou. Ajuste a quantidade.':delivery?'A taxa de entrega será confirmada pelo estabelecimento antes do pedido.':'O pedido será enviado ao estabelecimento para confirmação.'},
  clearCoupon(message=''){this.coupon=null;document.getElementById('coupon-status').textContent=message;this.renderCheckout()},
  couponError(code){return({coupon_already_used:'Este cupom já foi usado por este telefone.',first_order_only:'Este cupom é somente para o primeiro pedido deste telefone.',coupon_not_found:'Cupom inválido ou fora da validade.',invalid_phone:'Digite um WhatsApp válido para aplicar o cupom.',product_unavailable:'Um produto do carrinho não está mais disponível.'})[code]||'Não foi possível aplicar o cupom.'},
  async applyCoupon(){const form=document.getElementById('checkout-form'),code=form.elements.couponCode.value.trim().toUpperCase(),phone=form.elements.phone.value.trim(),button=document.getElementById('coupon-apply');if(!code){this.toast('Digite o cupom.');return}if(!phone){this.toast('Digite seu WhatsApp antes de aplicar o cupom.');return}button.disabled=true;document.getElementById('coupon-status').textContent='Verificando…';try{const response=await fetch(this.endpoint('/public/coupons/validate'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,phone,items:this.cartData().map(i=>({productId:i.product.id,quantity:i.quantity,expectedUnitPrice:Number(i.product.sale_price)}))})});const body=await response.json();if(!response.ok)throw new Error(body.error);this.coupon=body.data;document.getElementById('coupon-status').textContent=`Cupom aplicado: ${body.data.description}.`;this.renderCheckout()}catch(error){this.coupon=null;if(error.message==='catalog_changed'){await this.refresh();document.getElementById('coupon-status').textContent='O preço mudou. Confira o carrinho e aplique novamente.'}else document.getElementById('coupon-status').textContent=this.couponError(error.message);this.renderCheckout()}finally{button.disabled=false}},
  openCart(open){document.getElementById('cart-overlay').classList.toggle('open',open);document.getElementById('cart-overlay').setAttribute('aria-hidden',String(!open));document.body.style.overflow=open?'hidden':''},
  payload(form){const data=new FormData(form),fulfillmentType=this.tableNumber?'retirada':data.get('fulfillment');return{customer:{name:data.get('name'),phone:data.get('phone')},fulfillmentType,tableNumber:this.tableNumber,address:{postalCode:data.get('postalCode')||'',city:data.get('city')||'',street:data.get('street')||'',number:data.get('number')||'',district:data.get('district')||'',complement:data.get('complement')||'',reference:data.get('reference')||''},paymentMethod:data.get('payment'),couponCode:this.coupon?.code||'',notes:data.get('notes')||'',adultConfirmed:data.get('adultConfirmed')==='on',website:data.get('website')||'',items:this.cartData().map(i=>({productId:i.product.id,quantity:i.quantity,expectedUnitPrice:Number(i.product.sale_price),flavoredIce:this.supportsFlavoredIce(i.product.id)&&(this.flavoredIce.get(i.product.id)||false)}))}},
  validate(payload){if(!this.apiActive||!this.storefront)return'Cardápio indisponível. Tente novamente em instantes.';if(!this.storefront.isOpen)return'A loja está fechada no momento.';if(!payload.items.length)return'Adicione pelo menos um produto.';if(this.cartData().some(i=>i.product.current_stock!=null&&Number(i.product.current_stock)<i.quantity))return'O estoque de um item mudou. Ajuste a quantidade.';if(this.subtotal()<Number(this.storefront.minimumOrder ?? 20))return`O pedido mínimo é de ${this.money(Number(this.storefront.minimumOrder ?? 20))}.`;if(payload.fulfillmentType==='entrega'&&(!payload.address.postalCode||!payload.address.city||!payload.address.street||!payload.address.number||!payload.address.district))return'Preencha CEP, cidade, rua, número e bairro.';if(this.hasAlcohol()&&!payload.adultConfirmed)return'Confirme que você tem 18 anos ou mais.';return''},
  async submit(event){
    event.preventDefault();
    if(this.submitting)return;
    this.submitting=true;
    this.renderCheckout();
    const form=event.currentTarget;
    try{
      await this.refresh();
      const payload=this.payload(form),error=this.validate(payload);
      if(error){this.toast(error);return}
      const response=await fetch(this.endpoint('/public/orders'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
      const body=await response.json().catch(()=>({}));
      if(!response.ok){
        if(['catalog_changed','product_unavailable','insufficient_stock','payment_unavailable','minimum_order_not_met'].includes(body.error)){
          await this.refresh();
          this.toast('O cardápio mudou. Confira preços, disponibilidade e pagamento antes de tentar novamente.');
        }else if(body.error==='store_closed'){
          await this.refresh();this.toast('A loja está fechada no momento.');
        }else this.toast(this.couponError(body.error));
        return;
      }
      this.cart.clear();this.flavoredIce.clear();this.coupon=null;
      this.renderCatalog();this.renderCart();this.openCart(false);
      this.toast(`Pedido #${body.data.orderNumber} recebido!`);
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
