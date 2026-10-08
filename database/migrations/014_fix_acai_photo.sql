-- O cadastro legado aponta para um arquivo inexistente. Corrigir apenas o valor conhecido.
UPDATE products
SET photo_url = '../assets/products/acai.jpg', updated_at = now()
WHERE id = 'p-aca001'
  AND photo_url = '../assets/products/acai-joy.png';
