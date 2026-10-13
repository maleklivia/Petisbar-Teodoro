BEGIN;

-- Conteúdo das fotos fica no PostgreSQL e acompanha os backups do catálogo.
CREATE TABLE IF NOT EXISTS product_photo_assets (
  product_id text PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  image_bytes bytea NOT NULL CHECK (octet_length(image_bytes) BETWEEN 4 AND 1000000),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
