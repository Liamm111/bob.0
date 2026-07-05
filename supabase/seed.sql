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
   '{"primary":"#3B4A3F","accent":"#C9A26B","logoText":"Café Brume","bg":"#F5F1EA"}'::jsonb,
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
insert into menu_categories (id, cafe_id, name, sort_order) values
  ('c1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cafés & Boissons', 1),
  ('c1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Brunch & Lunch', 2),
  ('c1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Pâtisseries', 3),
  ('c1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Vins & Bulles', 4)
on conflict (id) do nothing;

insert into menu_items (cafe_id, category_id, name, description, price_cents, vat_rate, is_available, allergens, sort_order) values
  -- Boissons (2.6 % à emporter)
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'Café Filtre',        'Filtre du jour, torréfaction locale',        450,  2.6, true, '[]'::jsonb, 1),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'Cappuccino',         'Double ristretto, lait mousseux',            560,  2.6, true, '["lait"]'::jsonb, 2),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000001', 'Chai Latte',         'Épices maison, lait d''avoine',              620,  2.6, true, '["avoine"]'::jsonb, 3),
  -- Brunch (2.6 %)
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000002', 'Avocado Toast',      'Pain au levain, avocat, œuf poché',         1450, 2.6, true, '["gluten","oeuf"]'::jsonb, 1),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000002', 'Bowl Granola',       'Yaourt, granola maison, fruits de saison',   980, 2.6, true, '["lait","fruits-a-coque"]'::jsonb, 2),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000002', 'Croque Brume',       'Jambon, gruyère AOP, béchamel',             1350, 2.6, true, '["gluten","lait"]'::jsonb, 3),
  -- Pâtisseries (2.6 %)
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000003', 'Croissant Beurre',   'Pur beurre, feuilletage 3 jours',            340, 2.6, true, '["gluten","lait"]'::jsonb, 1),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000003', 'Cookie Chocolat',    'Chocolat noir 70 %, fleur de sel',           420, 2.6, false,'["gluten","oeuf","lait"]'::jsonb, 2),
  -- Alcool (8.1 % toujours)
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000004', 'Verre de Chasselas', 'AOC Genève, 1dl',                            700, 8.1, true, '["sulfites"]'::jsonb, 1),
  ('11111111-1111-1111-1111-111111111111', 'c1000000-0000-0000-0000-000000000004', 'Mimosa',             'Crémant & jus d''orange pressée',            950, 8.1, true, '["sulfites"]'::jsonb, 2)
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
