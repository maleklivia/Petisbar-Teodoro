INSERT INTO app_settings(key,value) VALUES
  ('storefront.minimumOrder','20'::jsonb),
  ('storefront.deliveryTime','"30–60 min"'::jsonb),
  ('storefront.isOpen','true'::jsonb),
  ('storefront.hours','"Horários definidos no ERP"'::jsonb),
  ('storefront.paymentMethods','["Pix","Dinheiro","Cartão na entrega"]'::jsonb),
  ('storefront.promotions','[{"title":"Promoções do dia","description":"Confira as promoções disponíveis no cardápio."}]'::jsonb),
  ('storefront.whatsapp','"5521975816050"'::jsonb)
ON CONFLICT(key) DO NOTHING;
