import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

function loadClient() {
  const elements = new Map();
  const fields = new Map(['city','street','district'].map(name => [name, { value: '', dataset: {} }]));
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', innerHTML: '',
      classList: { add() {}, remove() {}, toggle() {} },
      querySelector: () => ({ textContent: '' }),
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: { addEventListener() {}, getElementById: element, querySelector(selector) { const name=selector.match(/\[name="([^"]+)"\]/)?.[1]; return fields.get(name)||null; }, querySelectorAll() { return []; } },
    URLSearchParams, Intl, Map, Set, Number, JSON, AbortSignal,
  });
  vm.runInContext(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'js', 'cardapio.js'), 'utf8'), context);
  const client = vm.runInContext('Cardapio', context);
  client.renderStorefront = () => {};
  client.renderCategories = () => {};
  client.renderCheckout = () => {};
  const renderCart=()=>clientRenderCart.call(client),clientRenderCart=client.renderCart;
  client.renderCart = () => {};
  client.openCart = () => {};
  client.toast = () => {};
  client.escape = value => String(value);
  return { client, element, renderCart, fields, context };
}

test('preenche endereço ao consultar CEP sem substituir campos editados manualmente', async () => {
  const { client, element, fields, context } = loadClient();
  client.storefront = { deliveryZones: { zones: [{ prefixo: '24230', nome: 'Niterói', valor: 5 }] } };
  fields.get('city').value = 'Cidade escolhida pelo cliente';
  fields.get('street').value = 'Rua antiga';
  assert.equal(context.document.querySelector('[name="district"]'), fields.get('district'));
  context.fetch = async url => {
    assert.equal(url, 'https://viacep.com.br/ws/24230061/json/');
    return { ok: true, json: async () => ({ localidade: 'Niterói', logradouro: 'Rua das Flores', bairro: 'Centro' }) };
  };
  await client.lookupAddressByPostalCode('24230-061');
  assert.equal(fields.get('city').value, 'Cidade escolhida pelo cliente');
  assert.equal(fields.get('street').value, 'Rua antiga');
  assert.match(element('postal-code-status').textContent, /Endereço encontrado/);
  assert.equal(fields.get('district').value, 'Centro');
  assert.equal(fields.get('district').dataset.cepAutofilled, 'true');
});

test('informa com acolhimento quando o CEP é válido mas fica fora da área de entrega', async () => {
  const { client, element, fields, context } = loadClient();
  client.storefront = { deliveryZones: { zones: [{ prefixo: '24230', nome: 'Niterói', valor: 5 }] } };
  context.fetch = async url => {
    assert.equal(url, 'https://viacep.com.br/ws/01001000/json/');
    return { ok: true, json: async () => ({ localidade: 'São Paulo', logradouro: 'Praça da Sé', bairro: 'Sé' }) };
  };
  await client.lookupAddressByPostalCode('01001-000');
  assert.equal(fields.get('city').value, 'São Paulo');
  assert.equal(fields.get('street').value, 'Praça da Sé');
  assert.equal(fields.get('district').value, 'Sé');
  assert.equal(element('postal-code-status').textContent, client.deliveryAreaUnavailableMessage());
  assert.match(element('postal-code-status').textContent, /ainda não entregamos nessa região/i);
});

test('mantém aviso de CEP não encontrado quando o serviço não reconhece o código', async () => {
  const { client, element, context } = loadClient();
  client.storefront = { deliveryZones: { zones: [{ prefixo: '24230', nome: 'Niterói', valor: 5 }] } };
  context.fetch = async () => ({ ok: true, json: async () => ({ erro: true }) });
  await client.lookupAddressByPostalCode('00000000');
  assert.match(element('postal-code-status').textContent, /CEP não encontrado/);
  assert.doesNotMatch(element('postal-code-status').textContent, /ainda não entregamos/);
});

test('falha de API retira catálogo antigo e bloqueia pedidos', async () => {
  const { client, element } = loadClient();
  client.apiActive = true;
  client.products = [{ id: 'old', name: 'Preço antigo' }];
  client.fetchPublic = async () => { throw new Error('offline'); };
  await client.refresh();
  assert.equal(client.apiActive, false);
  assert.equal(client.products.length, 0);
  assert.match(element('catalog').innerHTML, /temporariamente indisponível/);
  assert.match(element('service-notice').textContent, /Não é possível fazer pedidos/);
});

test('usa cadastro recebido do ERP sem substituir nome, foto ou disponibilidade', async () => {
  const { client, element } = loadClient();
  client.fetchPublic = async path => path.endsWith('storefront')
    ? { isOpen: true, minimumOrder: 20 }
    : [{ id: 'p-br003', name: 'Nome do ERP', category: 'BATATAS RECHEADAS', description: 'Descrição do ERP', sale_price: 29.9, photo_url: '../assets/products/batatas-recheadas-referencia.jpg', current_stock: 0 }];
  await client.refresh();
  assert.equal(client.apiActive, true);
  assert.equal(client.categoryLabel('BATATAS RECHEADAS'), 'Batatas Recheadas');
  assert.equal(client.categoryMatches(client.products[0], 'Batatas Recheadas'), true);
  assert.match(element('catalog').innerHTML, /Nome do ERP/);
  assert.match(element('catalog').innerHTML, />Batatas Recheadas<\/span>/);
  assert.doesNotMatch(element('catalog').innerHTML, /BATATAS RECHEADAS/);
  assert.match(element('catalog').innerHTML, /assets\/products\/batatas-recheadas-referencia.jpg/);
  assert.match(element('catalog').innerHTML, /Indisponível/);
  assert.match(element('catalog').innerHTML, /disabled.*aria-label="Adicionar"/);
});

test('consolida água, refrigerante e energético na categoria Bebidas', () => {
  const { client } = loadClient();
  for (const raw of ['Águas', 'Refrigerantes', 'Energéticos']) {
    assert.equal(client.categoryLabel(raw), 'Bebidas');
    assert.equal(client.categoryMatches({ category: raw }, 'Bebidas'), true);
  }
  assert.equal(client.categoryMatches({ category: 'Petiscos' }, 'Bebidas'), false);
});

test('modo de testes libera item com estoque zero e respeita limite do pedido', async () => {
  const { client, element } = loadClient();
  client.fetchPublic = async path => path.endsWith('storefront')
    ? { isOpen: true, minimumOrder: 20, allowOrdersWithoutStockForTesting: true }
    : [{ id: 'food', name: 'Comida', category: 'Petiscos', description: '', sale_price: 29.9, current_stock: 0 }];
  await client.refresh();
  assert.doesNotMatch(element('catalog').innerHTML, /Indisponível/);
  assert.match(element('catalog').innerHTML, /aria-label="Adicionar">Adicionar/);
  assert.match(element('service-notice').textContent, /MODO DE TESTES/);
  assert.equal(client.stockLimit(client.products[0]), 20);
  client.storefront.allowOrdersWithoutStockForTesting = false;
  assert.equal(client.stockLimit(client.products[0]), 0);
});

test('preço de opção usa valor retornado pelo ERP', async () => {
  const { client } = loadClient();
  const batata = { id: 'p-pet002', sale_price: '27.90', option_prices: { G: 42, drinks: { 'coca-cola': 7.5 } } };
  assert.equal(client.productUnitPrice(batata, { size: 'G', drink: 'coca-cola' }), 49.5);
  assert.equal(client.productUnitPrice(batata, { size: 'P' }), 27.9);
  assert.ok(Number.isNaN(client.productUnitPrice(batata, { size: 'G', drink: 'agua' })));
  const soda = { id: 'p-ref001', sale_price: '5.00', option_prices: { soda: { 'coca-cola': 6.5, guarana: 5 } } };
  assert.equal(client.productUnitPrice(soda, { sodaFlavor: 'coca-cola' }), 6.5);
  assert.equal(client.productUnitPrice({ id: 'p-pet002', sale_price: 19.99, option_prices: { drinks: { agua: 4.99 } } }, { size: 'P', drink: 'agua' }), 24.98);
});

test('mostra opções configuradas no ERP e mantém unidades do mesmo produto separadas por escolha',()=>{
  const {client}=loadClient();
  client.apiActive=true;
  const product={id:'custom',name:'Porção',sale_price:20,current_stock:10,option_groups:[
    {key:'size',label:'Escolha o tamanho',type:'radio',required:true,options:[
      {value:'P',label:'Pequena',priceMode:'base'},
      {value:'G',label:'Grande',priceMode:'replace',priceProductId:'custom-g'},
    ]},
    {key:'drink',label:'Bebida adicional',type:'radio',required:false,options:[
      {value:'none',label:'Sem bebida',priceMode:'base'},
      {value:'cola',label:'Cola',priceMode:'add',priceProductId:'cola'},
    ]},
  ]};
  client.products=[product,{id:'custom-g',name:'Porção Grande',sale_price:30},{id:'cola',name:'Cola',sale_price:6}];
  const config=client.customizationConfig(product);
  assert.equal(config.groups[0].label,'Escolha o tamanho');
  assert.match(config.groups[0].options[1][1],/R\$\s?30/);
  assert.equal(client.productUnitPrice(product,{size:'G',drink:'cola'}),36);
  client.change('custom',1,{size:'P',drink:'none'});
  client.change('custom',1,{size:'G',drink:'cola'});
  assert.equal(client.cartData().length,2);
  assert.equal(client.subtotal(),56);
});

test('Batata Frita aparece uma vez e oferece P 300g e G 500g', async () => {
  const { client, element } = loadClient();
  client.fetchPublic = async path => path.endsWith('storefront')
    ? { isOpen: true, minimumOrder: 20, allowOrdersWithoutStockForTesting: true }
    : [{ id: 'p-pet001', name: 'Batata Frita', category: 'Petiscos', description: 'Escolha P ou G', sale_price: 17.9, current_stock: 0, option_prices: { G: 24.9 } }];
  await client.refresh();
  assert.equal((element('catalog').innerHTML.match(/<h2>Batata Frita<\/h2>/g) || []).length, 1);
  assert.equal(client.products.length, 1);
  const fries = client.products[0];
  assert.deepEqual([...client.customizationConfig(fries).groups[0].options].map(option => option[0]), ['P', 'G']);
  assert.match(client.customizationConfig(fries).groups[0].options[1][1], /500g/);
  assert.equal(client.productUnitPrice(fries, { size: 'P' }), 17.9);
  assert.equal(client.productUnitPrice(fries, { size: 'G' }), 24.9);
  assert.ok(Number.isNaN(client.productUnitPrice({ ...fries, option_prices: {} }, { size: 'G' })));
  assert.equal(client.stockLimit(fries), 20);
});

test('Caipirinha aparece uma vez e aceita sabores diferentes no mesmo carrinho', async () => {
  const { client, element } = loadClient();
  client.fetchPublic = async path => path.endsWith('storefront')
    ? { isOpen: true, minimumOrder: 20, allowOrdersWithoutStockForTesting: true }
    : [{ id: 'p-drk001', name: 'Caipirinha', category: 'Drinks', description: 'Escolha o sabor', sale_price: 15.9, current_stock: null, option_prices: { flavors: { morango: 16.9, maracuja: 17.9 } } }];
  await client.refresh();
  const drink = client.products[0];
  assert.equal((element('catalog').innerHTML.match(/<h2>Caipirinha<\/h2>/g) || []).length, 1);
  assert.deepEqual([...client.customizationConfig(drink).groups[0].options].map(option => option[0]), ['natural', 'morango', 'maracuja']);
  assert.equal(client.productUnitPrice(drink, { flavor: 'natural' }), 15.9);
  assert.equal(client.productUnitPrice(drink, { flavor: 'morango' }), 16.9);
  assert.equal(client.productUnitPrice(drink, { flavor: 'maracuja' }), 17.9);
  client.change('p-drk001', 1, { flavor: 'natural' });
  client.change('p-drk001', 1, { flavor: 'morango' });
  assert.equal(client.qty('p-drk001'), 2);
  assert.equal(client.cartData().length, 2);
  assert.equal(client.subtotal(), 32.8);
  client.change('p-drk001::morango', -1);
  assert.equal(client.cartData().length, 1);
  assert.equal(client.subtotal(), 15.9);
});

test('exibe uma imagem própria para cada um dos quatro combos', () => {
  const { client, element } = loadClient();
  const combos = [
    ['combo-batata', 'COMBO-BATATA-RECHEADA', 'Combo Duas Batatas Recheadas + Refrigerante', 'combo-duas-batatas-refrigerante.jpg', 'Duas batatas recheadas em cumbucas com refrigerante'],
    ['combo-caipirinha', 'COMBO-CAIPIRINHA-DOBRO', 'Combo Caipirinha em Dobro', 'combo-caipirinha-dobro.jpg', 'Duas caipirinhas com limão, gelo e morango'],
    ['combo-cerveja', 'COMBO-DUPLA-CERVEJAS', 'Combo Dupla de Cervejas', 'combo-dupla-cervejas.jpg', 'Duas cervejas geladas em copos'],
    ['combo-petisco', 'COMBO-PETISCO-BEBIDA', 'Combo Petisco + Bebida', 'combo-petisco-bebida.jpg', 'Petiscos variados acompanhados de refrigerante e água'],
  ];
  client.promotions = combos.map(([id, code, name]) => ({
    id, code, rule_type: 'combo', name, description: name,
    combo_price: 57.76, groups: [{ name: 'Escolha', requiredQuantity: 1 }],
  }));
  client.renderPromotions();
  const html = element('combo-catalog').innerHTML;
  assert.equal((html.match(/class="combo-image"/g) || []).length, 4);
  for (const [, , name, file, alt] of combos) {
    assert.ok(html.includes(`src="./assets/promotions/${file}"`));
    assert.ok(html.includes(`alt="${alt}"`));
    assert.ok(html.includes(name));
  }
  assert.equal(new Set(combos.map(([, , , file]) => file)).size, 4);
});

test('combo de escolhas exibe desconto e calcula os mesmos centavos sem acréscimos duplicados',()=>{
  const {client,element,renderCart}=loadClient();
  client.products=[{id:'potato',sale_price:29.9},{id:'p-ref001',sale_price:5,option_prices:{soda:{'coca-cola':6}}}];
  const promotion={id:'combo',name:'Combo',rule_type:'combo',combo_price:null,discount_percent:5,groups:[{id:'potatoes',name:'Batatas',requiredQuantity:2,products:[{id:'potato',surcharge:7.8}]},{id:'soda',name:'Refrigerante',requiredQuantity:1,products:[{id:'p-ref001',surcharge:0}]}]};
  const combo={promotion,selections:[{groupId:'potatoes',items:[{productId:'potato',quantity:2,options:{}}]},{groupId:'soda',items:[{productId:'p-ref001',quantity:1,options:{sodaFlavor:'coca-cola'}}]}]};
  assert.equal(client.comboAppliedPrice(combo),62.51);
  client.combos.set('one',combo);client.quote={subtotalNormal:65.8,promotionDiscount:3.29};client.renderCheckout=()=>{};
  renderCart();assert.equal(element('cart-fab-total').textContent,client.money(62.51));
  client.promotions=[promotion];client.renderPromotions();
  assert.match(element('combo-catalog').innerHTML,/Desconto aplicado nos itens escolhidos/);
  assert.doesNotMatch(element('combo-catalog').innerHTML,/A partir de R\$.*0,00/);
});
