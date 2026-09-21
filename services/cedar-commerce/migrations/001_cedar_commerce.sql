create schema if not exists cedar_commerce;
create extension if not exists pgcrypto;

create table if not exists cedar_commerce.products (
  id text primary key, slug text not null unique, name text not null, category text not null,
  short_description text not null, description text not null, rating numeric(2,1) not null,
  review_count integer not null default 0, specifications jsonb not null default '{}'::jsonb,
  delivery_estimate text not null, warranty text not null, featured boolean not null default false,
  new_arrival boolean not null default false, related_slugs jsonb not null default '[]'::jsonb,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists cedar_commerce.product_images (
  id text primary key, product_id text not null references cedar_commerce.products(id) on delete cascade,
  url text not null, alt text not null, sort_order integer not null default 0
);
create table if not exists cedar_commerce.product_variants (
  id text primary key, product_id text not null references cedar_commerce.products(id) on delete cascade,
  sku text not null unique, finish text not null, finish_hex text not null, configuration text not null,
  price integer not null check(price >= 0), compare_at_price integer check(compare_at_price is null or compare_at_price >= price),
  image_urls jsonb not null default '[]'::jsonb, active boolean not null default true
);
create table if not exists cedar_commerce.inventory (
  variant_id text primary key references cedar_commerce.product_variants(id) on delete cascade,
  available integer not null check(available >= 0), reserved integer not null default 0 check(reserved >= 0),
  updated_at timestamptz not null default now(), check(reserved <= available)
);
create table if not exists cedar_commerce.collections (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, description text not null,
  created_at timestamptz not null default now()
);
create table if not exists cedar_commerce.collection_products (
  collection_id uuid not null references cedar_commerce.collections(id) on delete cascade,
  product_id text not null references cedar_commerce.products(id) on delete cascade,
  position integer not null default 0, primary key(collection_id, product_id)
);
create table if not exists cedar_commerce.carts (
  id uuid primary key default gen_random_uuid(), session_token_hash text not null unique,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','CONVERTED','ABANDONED')),
  promo_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists cedar_commerce.cart_lines (
  id uuid primary key default gen_random_uuid(), cart_id uuid not null references cedar_commerce.carts(id) on delete cascade,
  variant_id text not null references cedar_commerce.product_variants(id), quantity integer not null check(quantity between 1 and 10),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(cart_id, variant_id)
);
create table if not exists cedar_commerce.customers (
  id uuid primary key default gen_random_uuid(), email text not null unique, first_name text not null, last_name text not null,
  phone text not null, synthetic boolean not null default true, created_at timestamptz not null default now(), check(synthetic)
);
create table if not exists cedar_commerce.addresses (
  id uuid primary key default gen_random_uuid(), customer_id uuid references cedar_commerce.customers(id) on delete cascade,
  first_name text not null, last_name text not null, phone text not null, line1 text not null, line2 text,
  city text not null, state text not null, country text not null default 'NG', synthetic boolean not null default true,
  created_at timestamptz not null default now(), check(synthetic)
);
create table if not exists cedar_commerce.checkouts (
  id uuid primary key default gen_random_uuid(), cart_id uuid not null unique references cedar_commerce.carts(id),
  email text, phone text, first_name text, last_name text, address_line1 text, address_line2 text,
  city text, state text, delivery_method text check(delivery_method in ('STANDARD','EXPRESS','PICKUP')),
  payment_method text check(payment_method in ('TEST_VISA_4242','PAY_ON_DELIVERY','SYNTHETIC_BANK_TRANSFER')),
  updated_at timestamptz not null default now()
);
create table if not exists cedar_commerce.orders (
  id uuid primary key default gen_random_uuid(), order_number text not null unique, cart_id uuid not null unique references cedar_commerce.carts(id),
  customer_id uuid references cedar_commerce.customers(id), status text not null default 'CONFIRMED',
  payment_status text not null, email text not null, phone text not null, delivery_address jsonb not null,
  delivery_method text not null, payment_method text not null, subtotal integer not null, discount integer not null,
  delivery integer not null, total integer not null, idempotency_key text not null unique,
  estimated_delivery text not null, created_at timestamptz not null default now()
);
create table if not exists cedar_commerce.order_lines (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references cedar_commerce.orders(id) on delete cascade,
  variant_id text not null references cedar_commerce.product_variants(id), product_name text not null,
  variant_label text not null, sku text not null, quantity integer not null, unit_price integer not null, image_url text not null
);
create table if not exists cedar_commerce.payment_attempts (
  id uuid primary key default gen_random_uuid(), checkout_id uuid not null references cedar_commerce.checkouts(id),
  method text not null, status text not null, synthetic boolean not null default true, attempted_at timestamptz not null default now(), check(synthetic)
);
create table if not exists cedar_commerce.fulfilments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references cedar_commerce.orders(id) on delete cascade,
  status text not null default 'PENDING', carrier text, tracking_code text, estimated_delivery text not null,
  created_at timestamptz not null default now()
);
create table if not exists cedar_commerce.promo_codes (
  code text primary key, percent_off integer not null check(percent_off between 1 and 90),
  minimum_subtotal integer not null default 0, active boolean not null default true,
  starts_at timestamptz not null, expires_at timestamptz not null, check(expires_at > starts_at)
);
create table if not exists cedar_commerce.integration_events (
  id uuid primary key default gen_random_uuid(), order_id uuid references cedar_commerce.orders(id),
  integration_id text not null, event_name text not null, purpose text not null, scenario text not null,
  attempted_payload jsonb not null, gateway_response jsonb, status text not null default 'PENDING',
  idempotency_key text not null unique, evidence_id text, created_at timestamptz not null default now(), dispatched_at timestamptz
);
create table if not exists cedar_commerce.operator_state (
  merchant_id text primary key, scenario text not null check(scenario in ('normal','unauthorized-field','flash-sale','proportional-abuse','shadow-integration','stale-crm')),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_idx on cedar_commerce.products(category) where active;
create index if not exists cart_lines_cart_idx on cedar_commerce.cart_lines(cart_id);
create index if not exists orders_email_idx on cedar_commerce.orders(email, created_at desc);
create index if not exists integration_events_status_idx on cedar_commerce.integration_events(status, created_at);

revoke all on schema cedar_commerce from public;
revoke all on all tables in schema cedar_commerce from public;
