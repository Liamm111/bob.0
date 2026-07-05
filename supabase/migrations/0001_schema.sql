-- =============================================================
-- Café Brume — Schéma Supabase (Click & Collect + Fidélité)
-- Version 1.0 · 5 juillet 2026 · Studio Léon
-- Multi-café (cafe_id) · RLS · points 1pt/CHF · expiration 12 mois
-- =============================================================
-- Modèle d'accès :
--   • STAFF (authentifié) → accès total à SON café via RLS (table staff).
--   • CLIENT (non authentifié) → jamais d'accès direct aux tables.
--     Menu public, création de commande et suivi passent par du code
--     serveur (service role) scopé par cafe_id, + une RPC de suivi par token.
-- =============================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;      -- emails insensibles à la casse

-- ---------- ENUMS -------------------------------------------------
create type order_status as enum
  ('pending_payment','paid','preparing','ready','collected','cancelled','refunded');

create type points_reason as enum
  ('earn','redeem','adjust','expire');

create type pass_platform as enum ('apple','google');

-- ---------- CAFÉS -------------------------------------------------
create table cafes (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,           -- brume, geneve...
  timezone        text not null default 'Europe/Zurich',
  currency        text not null default 'CHF',
  country_default text not null default 'CH',     -- pour la normalisation E.164
  stripe_account  text,
  brand_tokens    jsonb not null default '{}'::jsonb,  -- couleurs, logo pour le pass
  points_per_currency numeric not null default 1,      -- 1 pt / CHF
  points_expiry_months int not null default 12,
  created_at      timestamptz not null default now()
);

-- ---------- STAFF (rattachement auth.users ↔ café) ---------------
create table staff (
  user_id  uuid not null references auth.users(id) on delete cascade,
  cafe_id  uuid not null references cafes(id) on delete cascade,
  role     text not null default 'member',   -- 'owner' | 'member'
  created_at timestamptz not null default now(),
  primary key (user_id, cafe_id)
);

-- Helper : le café courant appartient-il à l'utilisateur connecté ?
create or replace function is_cafe_staff(target_cafe uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from staff
    where staff.user_id = auth.uid() and staff.cafe_id = target_cafe
  );
$$;

-- ---------- MENU --------------------------------------------------
create table menu_categories (
  id         uuid primary key default gen_random_uuid(),
  cafe_id    uuid not null references cafes(id) on delete cascade,
  name       text not null,
  sort_order int not null default 0
);

create table menu_items (
  id           uuid primary key default gen_random_uuid(),
  cafe_id      uuid not null references cafes(id) on delete cascade,
  category_id  uuid references menu_categories(id) on delete set null,
  name         text not null,
  description  text,
  price_cents  int not null check (price_cents >= 0),
  vat_rate     numeric not null default 2.6,   -- 2.6 à emporter, 8.1 alcool
  image_url    text,
  is_available boolean not null default true,
  allergens    jsonb not null default '[]'::jsonb,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index on menu_items (cafe_id, is_available);

-- ---------- CRÉNEAUX ----------------------------------------------
create table slots_config (
  id                 uuid primary key default gen_random_uuid(),
  cafe_id            uuid not null references cafes(id) on delete cascade unique,
  open_time          time not null default '08:00',
  close_time         time not null default '15:00',
  slot_minutes       int  not null default 15,
  capacity_per_slot  int  not null default 8,
  min_prep_minutes   int  not null default 20,
  is_ordering_open   boolean not null default true   -- "Rush stop"
);

-- ---------- CLIENTS (central, clé = téléphone E.164) --------------
create table customers (
  id               uuid primary key default gen_random_uuid(),
  cafe_id          uuid not null references cafes(id) on delete cascade,
  phone_e164       text not null,                 -- +41791234567 (normalisé côté app)
  phone_display    text,
  name             text,
  email            citext,
  points_balance   int not null default 0 check (points_balance >= 0),
  points_lifetime  int not null default 0,
  pass_serial      uuid unique,                   -- encodé dans le QR du Wallet pass
  pass_platform    pass_platform,
  marketing_consent boolean not null default false,
  joined_at        timestamptz not null default now(),
  last_order_at    timestamptz,
  last_activity_at timestamptz not null default now(),  -- base de l'expiration
  unique (cafe_id, phone_e164)
);
create index on customers (cafe_id, phone_e164);
create index on customers (pass_serial);

-- ---------- COMMANDES ---------------------------------------------
create table orders (
  id                    uuid primary key default gen_random_uuid(),
  cafe_id               uuid not null references cafes(id) on delete cascade,
  customer_id           uuid not null references customers(id),
  order_number          text not null,            -- lisible : BRU-2607-0042
  status                order_status not null default 'pending_payment',
  pickup_slot           timestamptz not null,
  subtotal_cents        int not null,
  vat_breakdown         jsonb not null default '{}'::jsonb,  -- { "2.6": 130, "8.1": 40 }
  total_cents           int not null,
  stripe_payment_intent text,
  track_token           uuid not null default gen_random_uuid(),  -- suivi sans login
  created_at            timestamptz not null default now(),
  unique (cafe_id, order_number)
);
create index on orders (cafe_id, status, pickup_slot);
create index on orders (track_token);

create table order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  menu_item_id    uuid references menu_items(id) on delete set null,
  name_snapshot   text not null,     -- fige le nom même si l'item change plus tard
  qty             int not null check (qty > 0),
  unit_price_cents int not null,
  vat_rate        numeric not null,
  note            text
);

-- ---------- FIDÉLITÉ : grand livre + récompenses ------------------
create table rewards (
  id          uuid primary key default gen_random_uuid(),
  cafe_id     uuid not null references cafes(id) on delete cascade,
  name        text not null,
  cost_points int not null check (cost_points > 0),
  is_active   boolean not null default true,
  sort_order  int not null default 0
);

create table points_ledger (
  id           uuid primary key default gen_random_uuid(),
  cafe_id      uuid not null references cafes(id) on delete cascade,
  customer_id  uuid not null references customers(id) on delete cascade,
  order_id     uuid references orders(id) on delete set null,
  reward_id    uuid references rewards(id) on delete set null,
  delta        int not null,          -- + gain, - dépense/expiration
  reason       points_reason not null,
  balance_after int not null,
  created_at   timestamptz not null default now()
);
create index on points_ledger (cafe_id, customer_id, created_at desc);

-- =============================================================
-- RPC : suivi de commande par token (accès client sans login)
-- SECURITY DEFINER → n'expose QUE la commande ciblée par le token.
-- =============================================================
create or replace function get_order_by_token(p_token uuid)
returns table (
  order_number text, status order_status, pickup_slot timestamptz,
  total_cents int, items jsonb
) language sql stable security definer set search_path = public as $$
  select o.order_number, o.status, o.pickup_slot, o.total_cents,
         coalesce(jsonb_agg(jsonb_build_object(
           'name', oi.name_snapshot, 'qty', oi.qty
         )), '[]'::jsonb)
  from orders o
  left join order_items oi on oi.order_id = o.id
  where o.track_token = p_token
  group by o.id;
$$;
revoke all on function get_order_by_token(uuid) from public;
grant execute on function get_order_by_token(uuid) to anon, authenticated;

-- =============================================================
-- RLS : tout activé. Le staff accède à SON café. Les clients
-- passent par le service role (serveur) ou la RPC de suivi.
-- =============================================================
alter table cafes            enable row level security;
alter table staff            enable row level security;
alter table menu_categories  enable row level security;
alter table menu_items       enable row level security;
alter table slots_config     enable row level security;
alter table customers        enable row level security;
alter table orders           enable row level security;
alter table order_items      enable row level security;
alter table rewards          enable row level security;
alter table points_ledger    enable row level security;

-- Staff : lire son/ses café(s)
create policy staff_reads_cafe on cafes
  for select using (is_cafe_staff(id));

-- Staff : voir ses rattachements
create policy staff_reads_self on staff
  for select using (user_id = auth.uid());

-- Gabarit "staff gère son café" appliqué aux tables scopées par cafe_id
create policy staff_all_menu_cat  on menu_categories for all
  using (is_cafe_staff(cafe_id)) with check (is_cafe_staff(cafe_id));
create policy staff_all_menu_item on menu_items for all
  using (is_cafe_staff(cafe_id)) with check (is_cafe_staff(cafe_id));
create policy staff_all_slots     on slots_config for all
  using (is_cafe_staff(cafe_id)) with check (is_cafe_staff(cafe_id));
create policy staff_all_customers on customers for all
  using (is_cafe_staff(cafe_id)) with check (is_cafe_staff(cafe_id));
create policy staff_all_orders    on orders for all
  using (is_cafe_staff(cafe_id)) with check (is_cafe_staff(cafe_id));
create policy staff_all_rewards   on rewards for all
  using (is_cafe_staff(cafe_id)) with check (is_cafe_staff(cafe_id));
create policy staff_all_ledger    on points_ledger for all
  using (is_cafe_staff(cafe_id)) with check (is_cafe_staff(cafe_id));

-- order_items : rattaché via l'order → on vérifie le café de l'order parent
create policy staff_all_order_items on order_items for all
  using (exists (select 1 from orders o
                 where o.id = order_items.order_id and is_cafe_staff(o.cafe_id)))
  with check (exists (select 1 from orders o
                 where o.id = order_items.order_id and is_cafe_staff(o.cafe_id)));

-- NB : aucune policy pour anon/customer sur ces tables. Les opérations
-- client (menu public, checkout, crédit de points) s'exécutent côté
-- serveur avec la service role key, scopées par cafe_id dans le code.

-- =============================================================
-- SEED — récompenses de départ (à ajuster librement)
-- Remplace :CAFE_ID par l'uuid du café.
-- =============================================================
-- insert into rewards (cafe_id, name, cost_points, sort_order) values
--   (':CAFE_ID', 'Boisson chaude offerte',        100, 1),
--   (':CAFE_ID', 'Pâtisserie offerte',            200, 2),
--   (':CAFE_ID', 'Un item lunch/brunch offert',   350, 3),
--   (':CAFE_ID', 'Brunch complet offert',         500, 4);

-- =============================================================
-- NOTES D'IMPLÉMENTATION (côté serveur, pas SQL)
-- 1. Crédit de points : au webhook Stripe payment_intent.succeeded,
--    dans UNE transaction → insert points_ledger(reason='earn'),
--    update customers.points_balance/points_lifetime/last_activity_at,
--    puis push maj du Wallet pass (APNs / Google Wallet API).
-- 2. Dépense : au scan du pass en boutique → insert ledger(reason='redeem',
--    delta négatif, reward_id), update balance, push maj du pass.
-- 3. Expiration : job mensuel (pg_cron / edge function) →
--    pour tout customer avec last_activity_at < now() - (points_expiry_months mois)
--    et points_balance > 0 → insert ledger(reason='expire', delta=-balance),
--    balance = 0.
-- 4. capacity créneau : décompte au paiement confirmé, réservation soft 10 min
--    pendant le checkout (à gérer en logique applicative + vérif serveur).
-- =============================================================
