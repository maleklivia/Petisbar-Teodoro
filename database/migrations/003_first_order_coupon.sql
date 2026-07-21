BEGIN;

CREATE TABLE coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
  discount_percent numeric(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  max_discount numeric(12,2) CHECK (max_discount IS NULL OR max_discount > 0),
  first_order_only boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true,
  starts_at timestamptz, ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), coupon_id uuid NOT NULL REFERENCES coupons(id),
  order_id text NOT NULL UNIQUE REFERENCES orders(id), phone_normalized text NOT NULL,
  discount_amount numeric(12,2) NOT NULL CHECK (discount_amount >= 0), redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, phone_normalized)
);

INSERT INTO coupons (code, discount_percent, max_discount, first_order_only, active)
VALUES ('PRIMEIROPEDIDO', 10, 10, true, true)
ON CONFLICT (code) DO UPDATE SET discount_percent=EXCLUDED.discount_percent, max_discount=EXCLUDED.max_discount,
  first_order_only=EXCLUDED.first_order_only, active=EXCLUDED.active, updated_at=now();

COMMIT;
