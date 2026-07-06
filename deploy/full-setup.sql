-- =============================================================
-- Café Brume — Setup complet Supabase (à coller dans SQL Editor)
-- Schéma + RPC fidélité + cron + storage + seed (Brume + Genève).
-- Généré : concat de supabase/migrations/*.sql + seed.sql
-- =============================================================

-- ----- 0001_schema.sql -----
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


-- ----- 0002_points_rpcs.sql -----
-- =============================================================
-- Café Brume — RPC fidélité + confirmation de commande
-- Transactions atomiques côté base : crédit / dépense / expiration.
-- Appelées depuis le serveur (service role). SECURITY DEFINER.
-- =============================================================

-- -------------------------------------------------------------
-- confirm_order_paid(order_id, payment_intent)
--   Appelé par le webhook Stripe `payment_intent.succeeded`.
--   UNE transaction : passe la commande en 'paid' (décompte ferme
--   du créneau), puis crédite les points (idempotent).
--   Idempotent : un second appel (retry Stripe) ne recrédite pas.
--   Renvoie le solde, le delta crédité et un flag de surréservation.
-- -------------------------------------------------------------
create or replace function confirm_order_paid(
  p_order_id uuid,
  p_payment_intent text
)
returns table (
  customer_id uuid,
  points_delta int,
  points_balance int,
  overbooked boolean,
  already_confirmed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order        orders%rowtype;
  v_cafe         cafes%rowtype;
  v_capacity     int;
  v_taken        int;
  v_delta        int := 0;
  v_new_balance  int;
  v_overbooked   boolean := false;
  v_already      boolean := false;
begin
  -- Verrouille la commande pour la durée de la transaction.
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found: %', p_order_id;
  end if;

  select * into v_cafe from cafes where id = v_order.cafe_id;

  -- Déjà confirmée (retry) → idempotent, on renvoie l'état courant.
  if v_order.status in ('paid','preparing','ready','collected') then
    select c.points_balance into v_new_balance from customers c where c.id = v_order.customer_id;
    return query select v_order.customer_id, 0, coalesce(v_new_balance, 0), false, true;
    return;
  end if;

  -- Recompte des places fermes déjà prises sur ce créneau (hors cette commande).
  select coalesce(cfg.capacity_per_slot, 0) into v_capacity
  from slots_config cfg where cfg.cafe_id = v_order.cafe_id;

  select count(*) into v_taken
  from orders o
  where o.cafe_id = v_order.cafe_id
    and o.pickup_slot = v_order.pickup_slot
    and o.status in ('paid','preparing','ready')
    and o.id <> v_order.id;

  -- Le paiement a réussi : on honore la commande même si le créneau
  -- est plein (l'argent est encaissé). On lève juste un drapeau.
  if v_taken >= v_capacity then
    v_overbooked := true;
  end if;

  update orders
     set status = 'paid',
         stripe_payment_intent = coalesce(p_payment_intent, stripe_payment_intent)
   where id = p_order_id;

  -- Crédit de points — idempotent : ne recrédite pas si un 'earn' existe déjà.
  if not exists (
    select 1 from points_ledger
    where order_id = p_order_id and reason = 'earn'
  ) then
    v_delta := floor((v_order.total_cents::numeric / 100.0) * v_cafe.points_per_currency)::int;

    update customers
       set points_balance   = customers.points_balance + v_delta,
           points_lifetime  = customers.points_lifetime + v_delta,
           last_order_at    = now(),
           last_activity_at = now()
     where id = v_order.customer_id
     returning customers.points_balance into v_new_balance;

    insert into points_ledger (cafe_id, customer_id, order_id, delta, reason, balance_after)
    values (v_order.cafe_id, v_order.customer_id, p_order_id, v_delta, 'earn', v_new_balance);
  else
    select c.points_balance into v_new_balance from customers c where c.id = v_order.customer_id;
  end if;

  return query select v_order.customer_id, v_delta, coalesce(v_new_balance, 0), v_overbooked, v_already;
end;
$$;

-- -------------------------------------------------------------
-- redeem_reward(customer_id, reward_id)
--   Appelé au scan du pass en boutique. Débite une récompense.
--   Garde-fou : solde suffisant + récompense active + même café.
-- -------------------------------------------------------------
create or replace function redeem_reward(
  p_customer_id uuid,
  p_reward_id uuid
)
returns table (points_balance int, spent int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer customers%rowtype;
  v_reward   rewards%rowtype;
  v_new_balance int;
begin
  select * into v_customer from customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer_not_found';
  end if;

  select * into v_reward from rewards where id = p_reward_id;
  if not found then
    raise exception 'reward_not_found';
  end if;
  if v_reward.cafe_id <> v_customer.cafe_id then
    raise exception 'reward_wrong_cafe';
  end if;
  if not v_reward.is_active then
    raise exception 'reward_inactive';
  end if;
  if v_customer.points_balance < v_reward.cost_points then
    raise exception 'insufficient_points: balance=% cost=%',
      v_customer.points_balance, v_reward.cost_points;
  end if;

  v_new_balance := v_customer.points_balance - v_reward.cost_points;

  update customers
     set points_balance   = v_new_balance,
         last_activity_at = now()
   where id = p_customer_id;

  insert into points_ledger (cafe_id, customer_id, reward_id, delta, reason, balance_after)
  values (v_customer.cafe_id, p_customer_id, p_reward_id, -v_reward.cost_points, 'redeem', v_new_balance);

  return query select v_new_balance, v_reward.cost_points;
end;
$$;

-- -------------------------------------------------------------
-- adjust_points(customer_id, delta)
--   Correction manuelle par le staff (reason='adjust').
--   Le solde ne peut pas devenir négatif.
-- -------------------------------------------------------------
create or replace function adjust_points(
  p_customer_id uuid,
  p_delta int
)
returns table (points_balance int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer customers%rowtype;
  v_new_balance int;
begin
  select * into v_customer from customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer_not_found';
  end if;

  v_new_balance := v_customer.points_balance + p_delta;
  if v_new_balance < 0 then
    raise exception 'adjust_would_go_negative: balance=% delta=%',
      v_customer.points_balance, p_delta;
  end if;

  update customers
     set points_balance   = v_new_balance,
         points_lifetime  = points_lifetime + greatest(p_delta, 0),
         last_activity_at = now()
   where id = p_customer_id;

  insert into points_ledger (cafe_id, customer_id, delta, reason, balance_after)
  values (v_customer.cafe_id, p_customer_id, p_delta, 'adjust', v_new_balance);

  return query select v_new_balance;
end;
$$;

-- -------------------------------------------------------------
-- expire_points()
--   Job mensuel. Pour chaque client inactif depuis
--   `cafes.points_expiry_months` mois avec un solde > 0 :
--   ledger(reason='expire', delta=-solde) puis solde = 0.
--   Renvoie le nombre de clients affectés.
-- -------------------------------------------------------------
create or replace function expire_points()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count int := 0;
begin
  for r in
    select cu.id, cu.cafe_id, cu.points_balance
    from customers cu
    join cafes c on c.id = cu.cafe_id
    where cu.points_balance > 0
      and cu.last_activity_at < now() - make_interval(months => c.points_expiry_months)
    for update of cu
  loop
    insert into points_ledger (cafe_id, customer_id, delta, reason, balance_after)
    values (r.cafe_id, r.id, -r.points_balance, 'expire', 0);

    update customers set points_balance = 0 where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Exécution réservée au service role (serveur) et au staff authentifié.
revoke all on function confirm_order_paid(uuid, text) from public;
revoke all on function redeem_reward(uuid, uuid) from public;
revoke all on function adjust_points(uuid, int) from public;
revoke all on function expire_points() from public;

grant execute on function confirm_order_paid(uuid, text) to service_role;
grant execute on function redeem_reward(uuid, uuid) to service_role, authenticated;
grant execute on function adjust_points(uuid, int) to service_role, authenticated;
grant execute on function expire_points() to service_role;

-- get_order_by_token (défini dans 0001, grantée à anon/authenticated) est aussi
-- appelée côté serveur avec le service role pour le suivi de commande : on lui
-- accorde l'exécution. La fonction reste SECURITY DEFINER et ne renvoie QUE la
-- commande ciblée par le token.
grant execute on function get_order_by_token(uuid) to service_role;


-- ----- 0003_pg_cron_expiry.sql -----
-- =============================================================
-- Café Brume — Expiration mensuelle des points (pg_cron)
-- Sur Supabase, pg_cron est disponible. Sur un Postgres nu (tests
-- locaux), l'extension peut manquer : on l'active de façon défensive
-- pour que la migration reste rejouable partout.
--
-- Fallback hébergement : si pg_cron n'est pas disponible, l'endpoint
-- Vercel Cron `GET /api/cron/expire` appelle `expire_points()`
-- (voir vercel.json + src/app/api/cron/expire/route.ts).
-- =============================================================

do $$
begin
  -- Tente d'activer pg_cron ; ignore proprement si indisponible.
  begin
    create extension if not exists pg_cron;
  exception
    when others then
      raise notice 'pg_cron indisponible (%): expiration à planifier via Vercel Cron.', sqlerrm;
      return;
  end;

  -- (Ré)planifie le job : le 1er de chaque mois à 03:00.
  begin
    perform cron.unschedule('cafe_expire_points');
  exception when others then
    null; -- pas encore planifié
  end;

  perform cron.schedule(
    'cafe_expire_points',
    '0 3 1 * *',
    $cron$ select expire_points(); $cron$
  );
exception
  when others then
    raise notice 'Planification pg_cron ignorée (%).', sqlerrm;
end;
$$;


-- ----- 0004_wallet_registrations.sql -----
-- =============================================================
-- Café Brume — Infrastructure Wallet (additif au schéma cœur)
--
-- Le schéma cœur (0001) modélise le client + son pass_serial, mais Apple
-- Wallet impose un web service qui MÉMORISE les appareils enregistrés
-- (deviceLibraryIdentifier + pushToken) pour pouvoir pousser une mise à jour
-- via APNs à chaque changement de solde. Cette table stocke ces enregistrements.
--
-- Google Wallet n'en a pas besoin (mise à jour = PATCH de l'objet), donc
-- aucune table n'est requise côté Google.
-- =============================================================

create table apple_wallet_registrations (
  id                    uuid primary key default gen_random_uuid(),
  cafe_id               uuid not null references cafes(id) on delete cascade,
  customer_id           uuid not null references customers(id) on delete cascade,
  pass_serial           uuid not null,
  device_library_id     text not null,
  push_token            text not null,
  created_at            timestamptz not null default now(),
  unique (device_library_id, pass_serial)
);
create index on apple_wallet_registrations (pass_serial);
create index on apple_wallet_registrations (cafe_id, customer_id);

alter table apple_wallet_registrations enable row level security;

-- Staff : lecture des enregistrements de SON café (debug/support).
create policy staff_reads_wallet_reg on apple_wallet_registrations
  for select using (is_cafe_staff(cafe_id));

-- Aucune policy anon/customer : le web service Apple s'exécute côté serveur
-- avec le service role (authentifié par le token d'autorisation du pass).


-- ----- 0005_credit_purchase.sql -----
-- =============================================================
-- Café Brume — Crédit de points sur un achat en personne (caisse)
--
-- Le staff saisit le téléphone du client + le montant de l'achat ; les points
-- se calculent automatiquement (montant × points_per_currency). Aucune
-- intégration POS : le montant vient du staff aujourd'hui, d'un POS demain
-- (V2) — la MÊME fonction sera appelée, sans rien réécrire.
--
-- Transaction atomique, comme les autres RPC fidélité. reason='earn',
-- order_id NULL (pas de commande en ligne rattachée).
-- =============================================================

create or replace function credit_purchase(
  p_customer_id uuid,
  p_amount_cents int
)
returns table (points_delta int, points_balance int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer customers%rowtype;
  v_cafe     cafes%rowtype;
  v_delta    int;
  v_new_balance int;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_amount: %', p_amount_cents;
  end if;

  select * into v_customer from customers where id = p_customer_id for update;
  if not found then
    raise exception 'customer_not_found';
  end if;

  select * into v_cafe from cafes where id = v_customer.cafe_id;

  v_delta := floor((p_amount_cents::numeric / 100.0) * v_cafe.points_per_currency)::int;

  update customers
     set points_balance   = customers.points_balance + v_delta,
         points_lifetime  = customers.points_lifetime + v_delta,
         last_order_at    = now(),
         last_activity_at = now()
   where id = p_customer_id
   returning customers.points_balance into v_new_balance;

  insert into points_ledger (cafe_id, customer_id, delta, reason, balance_after)
  values (v_customer.cafe_id, p_customer_id, v_delta, 'earn', v_new_balance);

  return query select v_delta, v_new_balance;
end;
$$;

revoke all on function credit_purchase(uuid, int) from public;
grant execute on function credit_purchase(uuid, int) to service_role, authenticated;


-- ----- 0006_menu_images_bucket.sql -----
-- =============================================================
-- Café Brume — Bucket Storage pour les photos de menu
--
-- Bucket public en lecture ; écriture réservée au service role (les
-- uploads passent par une server action côté serveur). Aucune policy
-- storage.objects → anon/authenticated ne peut pas écrire, le service
-- role contourne la RLS.
--
-- Défensif : le schéma `storage` n'existe que sur Supabase. Sur un
-- Postgres nu (tests), on saute proprement pour rester rejouable.
-- =============================================================

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public)
    values ('menu-images', 'menu-images', true)
    on conflict (id) do nothing;
    raise notice 'Bucket menu-images prêt.';
  else
    raise notice 'Schéma storage absent (Postgres nu) — créer le bucket menu-images sur Supabase.';
  end if;
end$$;


-- ----- seed.sql -----
-- =============================================================
-- Café Brume — Seed (données de départ)
-- Deux cafés pour valider l'isolation multi-café : « brume » et « geneve ».
-- Rien n'est codé en dur côté application : tout vient d'ici.
--
-- Les UUID sont figés pour des tests déterministes.
-- Les lignes auth.users sont créées pour rattacher le staff (RLS).
-- =============================================================

-- ---------- CAFÉS -------------------------------------------------
insert into cafes (id, name, slug, timezone, currency, country_default, brand_tokens,
                   points_per_currency, points_expiry_months)
values
  ('11111111-1111-1111-1111-111111111111', 'Café Brume', 'brume',
   'Europe/Zurich', 'CHF', 'CH',
   '{"primary":"#26251F","accent":"#C9A26B","logoText":"Café Brume","bg":"#F6F3EC"}'::jsonb,
   1, 12),
  ('22222222-2222-2222-2222-222222222222', 'Café Genève', 'geneve',
   'Europe/Zurich', 'CHF', 'CH',
   '{"primary":"#1F3A5F","accent":"#E0A458","logoText":"Café Genève","bg":"#EEF2F6"}'::jsonb,
   1, 12)
on conflict (id) do nothing;

-- ---------- STAFF (auth.users + rattachement) ---------------------
-- En local Supabase, ces lignes rendent la connexion possible via
-- le mot de passe ci-dessous (à changer en prod). Email + password.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'staff@brume.click', crypt('brume-dev-password', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'staff@geneve.click', crypt('geneve-dev-password', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into staff (user_id, cafe_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner')
on conflict do nothing;

-- ---------- SLOTS CONFIG ------------------------------------------
insert into slots_config (cafe_id, open_time, close_time, slot_minutes,
                          capacity_per_slot, min_prep_minutes, is_ordering_open)
values
  ('11111111-1111-1111-1111-111111111111', '08:00', '15:00', 15, 8, 20, true),
  ('22222222-2222-2222-2222-222222222222', '07:30', '16:00', 15, 10, 20, true)
on conflict (cafe_id) do nothing;

-- ---------- MENU (Café Brume) -------------------------------------
-- Menu réel Café Brume. Aucun alcool sur cette carte → tout à 2.6 % (à emporter).
insert into menu_categories (id, cafe_id, name, sort_order) values
  ('c1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Nos Cafés',       1),
  ('c1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Matcha',          2),
  ('c1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Jus Frais',       3),
  ('c1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Boissons Froides',4),
  ('c1000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Sandwiches',      5),
  ('c1000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Wraps',           6),
  ('c1000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Salades / Bowl',  7),
  ('c1000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'Desserts',        8),
  ('c1000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111', 'Extras',          9)
on conflict (id) do nothing;

insert into menu_items (cafe_id, category_id, name, description, price_cents, vat_rate, is_available, allergens, sort_order) values
  -- Nos Cafés (Chaud / Froid)
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'Espresso',              'Chaud ou froid',                                            420,  2.6, true, '[]'::jsonb, 1),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'Double Espresso',       'Chaud ou froid',                                            520,  2.6, true, '[]'::jsonb, 2),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'Americano',             'Chaud ou froid',                                            500,  2.6, true, '[]'::jsonb, 3),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'Flat White',            'Chaud ou froid',                                            620,  2.6, true, '["lait"]'::jsonb, 4),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'Cappuccino',            'Chaud ou froid',                                            580,  2.6, true, '["lait"]'::jsonb, 5),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'Café Latte',            'Sup. sirop +1.00 CHF : Vanille, Rose, Noisette, Caramel',   650,  2.6, true, '["lait"]'::jsonb, 6),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'Vanilla & Cookie Latte','Chaud ou froid',                                            650,  2.6, true, '["lait","gluten"]'::jsonb, 7),
  -- Matcha (Chaud / Froid)
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000002', 'Matcha Latte Classique','Chaud ou froid',                                            750,  2.6, true, '["lait"]'::jsonb, 1),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000002', 'Matcha Brume Érable',   'Sirop d''érable',                                           850,  2.6, true, '["lait"]'::jsonb, 2),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000002', 'Strawberry Matcha Latte','Fraise',                                                   900,  2.6, true, '["lait"]'::jsonb, 3),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000002', 'Rose Matcha Latte',     'Sirop de rose',                                             850,  2.6, true, '["lait"]'::jsonb, 4),
  -- Jus Frais (Maison)
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000003', 'Green Brume',           'Concombre, céleri, épinards frais, gingembre, citron',      850,  2.6, true, '[]'::jsonb, 1),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000003', 'Glow Brume',            'Betterave, grenade fraîche, pomme rouge, carotte, citron',  850,  2.6, true, '[]'::jsonb, 2),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000003', 'Ginger Brume',          'Gingembre, curcuma, orange, carotte, poivre noir',          850,  2.6, true, '[]'::jsonb, 3),
  -- Boissons Froides
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000004', 'Ice Tea Pêche',         'Maison',                                                    650,  2.6, true, '[]'::jsonb, 1),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000004', 'Ice Tea Passion',       'Maison',                                                    650,  2.6, true, '[]'::jsonb, 2),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000004', 'Eau Plate',             '',                                                          450,  2.6, true, '[]'::jsonb, 3),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000004', 'Eau Pétillante',        '',                                                          450,  2.6, true, '[]'::jsonb, 4),
  -- Sandwiches
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000005', 'Classic Egg',           'Pain brioché, oeuf brouillé, ciboulette, cheddar, sauce secrète',                         1450, 2.6, true, '["gluten","oeuf","lait"]'::jsonb, 1),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000005', 'Pastrami Deli',         'Pain au levain, pastrami de bœuf, cornichons, cheddar, moutarde au miel, mayonnaise',      1950, 2.6, true, '["gluten","lait","oeuf","moutarde"]'::jsonb, 2),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000005', 'Crispy Chicken Club',   'Pain brioché, poulet frit crispy (200g), cheddar, sucrine, tomates, bacon de dinde, mayonnaise épicée. Maxi 23.50 CHF', 1600, 2.6, true, '["gluten","lait","oeuf"]'::jsonb, 3),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000005', 'Truffle Stracciatella', 'Pain brioché, stracciatella de burrata, champignons, pousses d''épinards, noisettes, miel, huile de truffe', 1850, 2.6, true, '["gluten","lait","fruits-a-coque"]'::jsonb, 4),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000005', 'Deli Avocado Fold',     'Pain au levain, cream cheese, avocat, citron, grenade, piment d''Espelette',               1750, 2.6, true, '["gluten","lait"]'::jsonb, 5),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000005', 'Tuna Melt',             'Pain brioché, thon, mayonnaise, oignons rouges, cornichons, cheddar',                      1450, 2.6, true, '["gluten","poisson","oeuf","lait"]'::jsonb, 6),
  -- Wraps
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000006', 'Caesar Wrap',           'Tortilla, poulet frit crispy, sucrine, bacon de dinde, parmesan, sauce Caesar maison',     1650, 2.6, true, '["gluten","lait","oeuf"]'::jsonb, 1),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000006', 'Breakfast Burrito Wrap','Tortilla, oeufs brouillés, ciboulette, hashbrown, cheddar, avocat, sauce tomate salsa épicée', 1650, 2.6, true, '["gluten","oeuf","lait"]'::jsonb, 2),
  -- Salades / Bowl
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000007', 'Brume Salmon Bowl',     'Quinoa, saumon, edamame, chou rouge, avocat, sésame, vinaigrette',                         2150, 2.6, true, '["poisson","soja","sesame"]'::jsonb, 1),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000007', 'Salade Grek',           'Chou kale, roquette, feta AOP, concombre, tomate, pois chiches, graines de tournesol, vinaigrette, citron, tahini', 1750, 2.6, true, '["lait","sesame"]'::jsonb, 2),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000007', 'Tuna Nicoise',          'Salade, épeautre, thon, oeuf mollet, haricots verts, olives, tomates, vinaigrette, citron, câpres', 1950, 2.6, true, '["gluten","poisson","oeuf"]'::jsonb, 3),
  -- Desserts
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000008', 'Carrot Cake',           'Part 5.00 / grande part 7.50 CHF',                          500,  2.6, true, '["gluten","oeuf","lait","fruits-a-coque"]'::jsonb, 1),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000008', 'Banana Bread',          'Part 4.50 / grande part 6.50 CHF',                          450,  2.6, true, '["gluten","oeuf","lait"]'::jsonb, 2),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000008', 'Granola Bowl',          '',                                                          750,  2.6, true, '["lait","fruits-a-coque"]'::jsonb, 3),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000008', 'Cookie Brume',          'Matcha, noix de macadamia',                                 600,  2.6, true, '["gluten","oeuf","lait","fruits-a-coque"]'::jsonb, 4),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000008', 'Cookie Choco',          '',                                                          550,  2.6, true, '["gluten","oeuf","lait"]'::jsonb, 5),
  -- Extras
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000009', 'Supplément Truffe',     'Mayonnaise à la truffe blanche ou huile de truffe',         250,  2.6, true, '["oeuf"]'::jsonb, 1),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000009', 'Supplément Bacon de dinde', '',                                                      200,  2.6, true, '[]'::jsonb, 2)
on conflict do nothing;

-- ---------- MENU (Café Genève) — minimal, pour l'isolation --------
insert into menu_categories (id, cafe_id, name, sort_order) values
  ('c2000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Boissons', 1)
on conflict (id) do nothing;

insert into menu_items (cafe_id, category_id, name, description, price_cents, vat_rate, is_available, sort_order) values
  ('22222222-2222-2222-2222-222222222222', 'c2000000-0000-0000-0000-000000000001', 'Espresso', 'Simple', 400, 2.6, true, 1)
on conflict do nothing;

-- ---------- RÉCOMPENSES -------------------------------------------
insert into rewards (cafe_id, name, cost_points, is_active, sort_order) values
  ('11111111-1111-1111-1111-111111111111', 'Boisson chaude offerte',      100, true, 1),
  ('11111111-1111-1111-1111-111111111111', 'Pâtisserie offerte',          200, true, 2),
  ('11111111-1111-1111-1111-111111111111', 'Un item lunch/brunch offert', 350, true, 3),
  ('11111111-1111-1111-1111-111111111111', 'Brunch complet offert',       500, true, 4),
  ('22222222-2222-2222-2222-222222222222', 'Espresso offert',             100, true, 1)
on conflict do nothing;
