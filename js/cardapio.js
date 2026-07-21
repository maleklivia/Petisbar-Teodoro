const Cardapio = {
  apiActive: false, products: [], cart: new Map(), category: 'Todos', search: '', deliveryFee: 0,
  fallback: [
    ['p-drk001','Caipirinha Limão 500ml','Drinks','Cachaça 51, limão, açúcar e gelo',15.9,'caipirinha.jpg'],
    ['p-drk002','Caipirinha Morango 500ml','Drinks','Cachaça 51, morango, açúcar e gelo',16.9,'caipirinha.jpg'],
    ['p-drk003','Caipirinha Maracujá 500ml','Drinks','Cachaça 51, maracujá, açúcar e gelo',17.9,'caipirinha.jpg'],
    ['p-drk004','Caipivodka Limão 500ml','Drinks','Vodka Smirnoff, limão, açúcar e gelo',19.9,'caipirinha.jpg'],
    ['p-drk005','Caipivodka Morango 500ml','Drinks','Vodka Smirnoff, morango, açúcar e gelo',20.9,'caipirinha.jpg'],
    ['p-drk006','Caipivodka Maracujá 500ml','Drinks','Vodka Smirnoff, maracujá, açúcar e gelo',21.9,'caipirinha.jpg'],
    ['p-drk010','Vodka + Energético 500ml','Drinks','Vodka Smirnoff, energético e gelo',19.9,'energy-cocktail.jpg'],
    ['p-drk011','Whisky + Energético 500ml','Drinks','Whisky Red Label, energético e gelo',24.9,'energy-cocktail.jpg'],
    ['p-bee001','Brahma Lata 350ml','Cervejas','Cerveja Brahma lata 350ml',6,'beer.jpg'],
    ['p-bee002','Skol Lata 350ml','Cervejas','Cerveja Skol lata 350ml',6,'beer.jpg'],
    ['p-bee003','Corona 355ml','Cervejas','Cerveja Corona garrafa 355ml',12,'beer.jpg'],
    ['p-bee004','Heineken 330ml','Cervejas','Cerveja Heineken 330ml',10,'beer.jpg'],
    ['p-bee005','Budweiser 350ml','Cervejas','Cerveja Budweiser lata 350ml',8,'beer.jpg'],
    ['p-bee006','Artesanal 600ml','Cervejas','Cerveja artesanal local 600ml',18,'beer.jpg'],
    ['p-ref001','Coca-Cola 350ml','Refrigerantes','Coca-Cola lata 350ml',6,'soda.jpg'],
    ['p-ref002','Guaraná Antarctica 350ml','Refrigerantes','Guaraná Antarctica lata 350ml',5,'soda.jpg'],
    ['p-ref003','Sprite 350ml','Refrigerantes','Sprite lata 350ml',5,'soda.jpg'],
    ['p-ref004','Schweppes Tônica 350ml','Refrigerantes','Água tônica lata 350ml',5.5,'soda.jpg'],
    ['p-agu001','Água Mineral 500ml','Águas','Água mineral sem gás',3,'water.jpg'],
    ['p-agu002','Água com Gás 500ml','Águas','Água mineral com gás',4,'water.jpg'],
    ['p-ene001','Red Bull 250ml','Energéticos','Red Bull lata 250ml',12,'energy-drink.jpg'],
    ['p-ene002','Monster Energy 473ml','Energéticos','Monster Energy lata 473ml',12,'energy-drink.jpg'],
    ['p-aca001','Batidinha de Açaí 300ml','Açaí','Açaí batido em garrafinha de 300ml',15,'acai.jpg'],
    ['p-con001','Amendoim Temperado 100g','Conveniência','Amendoim crocante temperado',8,'snacks.jpg'],
    ['p-con002','Mix de Nuts 100g','Conveniência','Mix de castanhas e nozes',12,'snacks.jpg'],
    ['p-con003','Batata Chips 60g','Conveniência','Batata chips sabor original',8,'snacks.jpg'],
    ['p-con004','Azeitona Temperada 100g','Conveniência','Azeitona verde temperada',10,'snacks.jpg'],
    ['p-con005','Torresmo 150g','Conveniência','Torresmo artesanal crocante',15,'snacks.jpg'],
  ].map(([id,name,category,description,price,image])=>({id,name,category,description,sale_price:price,photo_url:`./assets/products/${image}`})),

  money(value){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value)},
  escape(value){const el=document.createElement('div');el.textContent=String(value??'');return el.innerHTML},
  image(url){if(!url)return './assets/products/snacks.jpg';return url.replace(/^\.\.\//,'./')},
  endpoint(path){return new URL(`./api/v1${path}`,location.href).href},
  async init(){
    try{const response=await fetch(this.endpoint('/public/catalog'),{headers:{Accept:'application/json'}});if(!response.ok)throw new Error();const body=await response.json();this.products=body.data;this.apiActive=true}
    catch{this.products=this.fallback;document.getElementById('service-notice').classList.remove('hidden');document.getElementById('service-notice').textContent='Pedidos automáticos em fase de ativação. Por enquanto, a finalização será enviada pelo WhatsApp.'}
    this.bind();this.renderCategories();this.renderCatalog();this.renderCart();
  },
  bind(){
    document.getElementById('catalog-search').addEventListener('input',e=>{this.search=e.target.value.toLowerCase();this.renderCatalog()});
    document.getElementById('category-list').addEventListener('click',e=>{const button=e.target.closest('[data-category]');if(!button)return;this.category=button.dataset.category;this.renderCategories();this.renderCatalog()});
    document.getElementById('catalog').addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(button)this.change(button.dataset.id,button.dataset.action==='inc'?1:-1)});
    document.getElementById('cart-items').addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(button)this.change(button.dataset.id,button.dataset.action==='inc'?1:-1)});
    document.getElementById('cart-fab').addEventListener('click',()=>this.openCart(true));document.getElementById('cart-close').addEventListener('click',()=>this.openCart(false));
    document.getElementById('cart-overlay').addEventListener('click',e=>{if(e.target.id==='cart-overlay')this.openCart(false)});
    document.querySelectorAll('[name="fulfillment"]').forEach(input=>input.addEventListener('change',()=>this.renderCheckout()));
    document.getElementById('checkout-form').addEventListener('submit',e=>this.submit(e));
  },
  qty(id){return this.cart.get(id)||0},
  change(id,delta){const qty=Math.max(0,this.qty(id)+delta);qty?this.cart.set(id,qty):this.cart.delete(id);this.renderCatalog();this.renderCart()},
  categories(){return ['Todos',...new Set(this.products.map(p=>p.category))]},
  renderCategories(){document.getElementById('category-list').innerHTML=this.categories().map(c=>`<button class="category-button ${c===this.category?'active':''}" data-category="${this.escape(c)}">${this.escape(c)}</button>`).join('')},
  renderCatalog(){
    const list=this.products.filter(p=>(this.category==='Todos'||p.category===this.category)&&(`${p.name} ${p.description}`.toLowerCase().includes(this.search)));
    document.getElementById('catalog').innerHTML=list.length?list.map(p=>{const q=this.qty(p.id);return `<article class="product-card ${q?'selected':''}"><img class="product-image" src="${this.escape(this.image(p.photo_url))}" alt="" loading="lazy"><div class="product-info"><span class="product-category">${this.escape(p.category)}</span><h2>${this.escape(p.name)}</h2><p class="product-description">${this.escape(p.description)}</p><div class="product-footer"><span class="product-price">${this.money(Number(p.sale_price))}</span><div class="qty-control" aria-label="Quantidade"><button data-action="dec" data-id="${this.escape(p.id)}" ${q?'':'disabled'} aria-label="Diminuir">−</button><output>${q}</output><button data-action="inc" data-id="${this.escape(p.id)}" aria-label="Adicionar">+</button></div></div></div></article>`}).join(''):'<div class="catalog-empty">Nenhum produto encontrado.</div>';
  },
  cartData(){return [...this.cart].map(([id,quantity])=>({product:this.products.find(p=>p.id===id),quantity})).filter(i=>i.product)},
  subtotal(){return this.cartData().reduce((s,i)=>s+Number(i.product.sale_price)*i.quantity,0)},
  hasAlcohol(){return this.cartData().some(i=>['Drinks','Cervejas'].includes(i.product.category))},
  renderCart(){
    const data=this.cartData(),count=data.reduce((s,i)=>s+i.quantity,0),subtotal=this.subtotal();
    document.getElementById('cart-fab').classList.toggle('hidden',!count);document.getElementById('cart-count').textContent=count;document.getElementById('cart-fab-total').textContent=this.money(subtotal);
    document.getElementById('cart-items').innerHTML=data.map(i=>`<div class="cart-item"><div><strong>${this.escape(i.product.name)}</strong><small>${i.quantity} × ${this.money(Number(i.product.sale_price))}</small></div><div class="qty-control"><button data-action="dec" data-id="${this.escape(i.product.id)}">−</button><output>${i.quantity}</output><button data-action="inc" data-id="${this.escape(i.product.id)}">+</button></div></div>`).join('');
    this.renderCheckout();
  },
  renderCheckout(){const delivery=document.querySelector('[name="fulfillment"]:checked')?.value==='entrega';document.getElementById('address-fields').classList.toggle('hidden',!delivery);document.getElementById('delivery-row').classList.toggle('hidden',!delivery);document.getElementById('adult-field').classList.toggle('hidden',!this.hasAlcohol());document.getElementById('checkout-subtotal').textContent=this.money(this.subtotal());document.getElementById('checkout-total').textContent=delivery&&this.apiActive?this.money(this.subtotal()+this.deliveryFee):this.money(this.subtotal());const btn=document.getElementById('checkout-button');btn.textContent=this.apiActive?'Confirmar pedido':'Enviar pedido pelo WhatsApp';document.getElementById('checkout-help').textContent=this.apiActive?'Você receberá o número do pedido após a confirmação.':'O pedido só será confirmado depois que a mensagem for enviada.'},
  openCart(open){document.getElementById('cart-overlay').classList.toggle('open',open);document.getElementById('cart-overlay').setAttribute('aria-hidden',String(!open));document.body.style.overflow=open?'hidden':''},
  payload(form){const data=new FormData(form),fulfillmentType=data.get('fulfillment');return{customer:{name:data.get('name'),phone:data.get('phone')},fulfillmentType,address:{street:data.get('street')||'',number:data.get('number')||'',district:data.get('district')||'',complement:data.get('complement')||'',reference:''},paymentMethod:data.get('payment'),notes:data.get('notes')||'',adultConfirmed:data.get('adultConfirmed')==='on',website:data.get('website')||'',items:this.cartData().map(i=>({productId:i.product.id,quantity:i.quantity}))}},
  validate(payload){if(!payload.items.length)return'Adicione pelo menos um produto.';if(payload.fulfillmentType==='entrega'&&(!payload.address.street||!payload.address.number||!payload.address.district))return'Preencha rua, número e bairro.';if(this.hasAlcohol()&&!payload.adultConfirmed)return'Confirme que você tem 18 anos ou mais.';return''},
  message(payload){const lines=['*NOVO PEDIDO — PETISBAR TEODORO*','',...this.cartData().map(i=>`• ${i.quantity}x ${i.product.name} — ${this.money(Number(i.product.sale_price)*i.quantity)}`),'',`*Subtotal:* ${this.money(this.subtotal())}`,`*Recebimento:* ${payload.fulfillmentType==='entrega'?'Entrega':'Retirada'}`,`*Pagamento:* ${payload.paymentMethod}`,`*Cliente:* ${payload.customer.name}`,`*Telefone:* ${payload.customer.phone}`];if(payload.fulfillmentType==='entrega')lines.push(`*Endereço:* ${payload.address.street}, ${payload.address.number} — ${payload.address.district}${payload.address.complement?' — '+payload.address.complement:''}`);if(payload.notes)lines.push(`*Observações:* ${payload.notes}`);lines.push('','Aguardando confirmação do estabelecimento.');return lines.join('\n')},
  async submit(event){event.preventDefault();const form=event.currentTarget,payload=this.payload(form),error=this.validate(payload);if(error){this.toast(error);return}const button=document.getElementById('checkout-button');button.disabled=true;
    if(this.apiActive){try{const response=await fetch(this.endpoint('/public/orders'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const body=await response.json();if(!response.ok)throw new Error(body.error);this.cart.clear();this.renderCatalog();this.renderCart();this.openCart(false);this.toast(`Pedido #${body.data.orderNumber} recebido!`);form.reset();return}catch{this.toast('O servidor não respondeu. Vamos enviar pelo WhatsApp.')}}
    window.location.href=`https://wa.me/?text=${encodeURIComponent(this.message(payload))}`;button.disabled=false;
  },
  toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.classList.remove('show'),3500)},
};
document.addEventListener('DOMContentLoaded',()=>Cardapio.init());
