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
