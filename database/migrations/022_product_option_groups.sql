BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS option_groups jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(option_groups) = 'array');

-- Move os grupos atuais do cardápio para o cadastro ERP sem alterar preço,
-- disponibilidade ou estoque dos produtos.
UPDATE products SET option_groups='[
  {"key":"flavor","label":"Escolha o sabor","type":"radio","required":true,"options":[
    {"value":"natural","label":"Limão","priceMode":"base","stockMode":"none"},
    {"value":"morango","label":"Morango","priceMode":"replace","stockMode":"replace","priceProductId":"p-drk002"},
    {"value":"maracuja","label":"Maracujá","priceMode":"replace","stockMode":"replace","priceProductId":"p-drk003"}
  ]}
]'::jsonb WHERE id='p-drk001' AND option_groups='[]'::jsonb;

UPDATE products SET option_groups='[
  {"key":"size","label":"Escolha o tamanho","type":"radio","required":true,"options":[
    {"value":"P","label":"P — 300g","priceMode":"base","stockMode":"none"},
    {"value":"G","label":"G — 500g","priceMode":"replace","stockMode":"replace","priceProductId":"p-pet006"}
  ]}
]'::jsonb WHERE id='p-pet001' AND option_groups='[]'::jsonb;

UPDATE products SET option_groups='[
  {"key":"size","label":"Escolha o tamanho","type":"radio","required":true,"options":[
    {"value":"500ml","label":"500 ml","priceMode":"base","stockMode":"none"},
    {"value":"700ml","label":"700 ml","priceMode":"replace","stockMode":"replace","priceProductId":"p-drk011"}
  ]},
  {"key":"beverage","label":"Escolha a bebida","type":"radio","required":true,"options":[
    {"value":"vodka","label":"Vodka Smirnoff","priceMode":"base","stockMode":"none"},
    {"value":"whisky","label":"Whisky","priceMode":"base","stockMode":"none"}
  ]},
  {"key":"iceFlavor","label":"Escolha o sabor do gelo","type":"radio","required":true,"options":[
    {"value":"coco","label":"Coco","priceMode":"base","stockMode":"none"},
    {"value":"maracuja","label":"Maracujá","priceMode":"base","stockMode":"none"}
  ]}
]'::jsonb WHERE id='p-drk010' AND option_groups='[]'::jsonb;

UPDATE products SET option_groups='[
  {"key":"sodaFlavor","label":"Escolha o refrigerante","type":"radio","required":true,"options":[
    {"value":"coca-cola","label":"Coca-Cola 350ml","priceMode":"replace","stockMode":"none","priceProductId":"p-ref005"},
    {"value":"guarana","label":"Guaraná Antarctica 350ml","priceMode":"replace","stockMode":"none","priceProductId":"p-ref002"},
    {"value":"sprite","label":"Sprite 350ml","priceMode":"replace","stockMode":"none","priceProductId":"p-ref003"}
  ]}
]'::jsonb WHERE id='p-ref001' AND option_groups='[]'::jsonb;

UPDATE products SET option_groups='[
  {"key":"size","label":"Escolha o tamanho","type":"radio","required":true,"options":[
    {"value":"P","label":"P — 400g","priceMode":"base","stockMode":"none"},
    {"value":"G","label":"G — 700g","priceMode":"replace","stockMode":"none","priceProductId":"p-pet007"}
  ]},
  {"key":"drink","label":"Adicionar uma bebida","type":"radio","required":false,"options":[
    {"value":"none","label":"Sem bebida","priceMode":"base","stockMode":"none"},
    {"value":"coca-cola","label":"Coca-Cola 350ml","priceMode":"add","stockMode":"none","priceProductId":"p-ref005"},
    {"value":"guarana","label":"Guaraná Antarctica 350ml","priceMode":"add","stockMode":"none","priceProductId":"p-ref002"},
    {"value":"agua","label":"Água mineral 500ml","priceMode":"add","stockMode":"none","priceProductId":"p-agu001"}
  ]}
]'::jsonb WHERE id='p-pet002' AND option_groups='[]'::jsonb;

UPDATE products SET option_groups='[
  {"key":"flavor","label":"Escolha o sabor","type":"radio","required":true,"options":[
    {"value":"natural","label":"Natural","priceMode":"base","stockMode":"none"},
    {"value":"morango","label":"Morango","priceMode":"base","stockMode":"none"},
    {"value":"maracuja","label":"Maracujá","priceMode":"base","stockMode":"none"}
  ]},
  {"key":"complement","label":"Escolha os complementos","type":"checkbox","required":false,"options":[
    {"value":"leite-condensado","label":"Leite condensado","priceMode":"base","stockMode":"none"},
    {"value":"leite-em-po","label":"Leite em pó","priceMode":"base","stockMode":"none"},
    {"value":"granola","label":"Granola","priceMode":"base","stockMode":"none"},
    {"value":"pacoca","label":"Paçoca","priceMode":"base","stockMode":"none"}
  ]}
]'::jsonb WHERE id='p-aca001' AND option_groups='[]'::jsonb;

COMMIT;
