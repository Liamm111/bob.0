-- =============================================================
-- Tests de la couche base : RPC fidélité + isolation RLS.
-- Exécuté après bootstrap + migrations + seed.
-- Chaque bloc lève une exception si l'invariant est violé
-- (=> le script s'arrête en erreur, code retour != 0).
-- =============================================================

\set ON_ERROR_STOP on

-- ---- Fixtures : un client + une commande sur Café Brume ----------
insert into customers (id, cafe_id, phone_e164, name, points_balance, last_activity_at)
values ('d0000000-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        '+41791234567', 'Test', 0, now());

insert into orders (id, cafe_id, customer_id, order_number, status, pickup_slot,
                    subtotal_cents, vat_breakdown, total_cents)
values ('e0000000-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'd0000000-0000-0000-0000-000000000001',
        'BRU-TEST-0001', 'pending_payment', now() + interval '1 hour',
        2000, '{"2.6":52}'::jsonb, 2052);

-- ---- confirm_order_paid : crédit de points + statut paid ---------
do $$
declare r record;
begin
  select * into r from confirm_order_paid('e0000000-0000-0000-0000-000000000001', 'pi_test_123');
  -- total 2052 cents = 20.52 CHF, 1pt/CHF => floor(20.52) = 20 pts
  if r.points_delta <> 20 then
    raise exception 'FAIL credit: attendu 20 pts, obtenu %', r.points_delta;
  end if;
  if r.points_balance <> 20 then
    raise exception 'FAIL balance: attendu 20, obtenu %', r.points_balance;
  end if;
  if (select status from orders where id = 'e0000000-0000-0000-0000-000000000001') <> 'paid' then
    raise exception 'FAIL statut: commande non passée à paid';
  end if;
  raise notice 'OK confirm_order_paid: +% pts, balance=%', r.points_delta, r.points_balance;
end$$;

-- ---- Idempotence : un second appel ne recrédite pas --------------
do $$
declare r record; v_ledger_count int;
begin
  select * into r from confirm_order_paid('e0000000-0000-0000-0000-000000000001', 'pi_test_123');
  if r.points_delta <> 0 or not r.already_confirmed then
    raise exception 'FAIL idempotence: recrédit détecté (delta=%, already=%)', r.points_delta, r.already_confirmed;
  end if;
  select count(*) into v_ledger_count from points_ledger
   where order_id = 'e0000000-0000-0000-0000-000000000001' and reason = 'earn';
  if v_ledger_count <> 1 then
    raise exception 'FAIL idempotence: % lignes earn (attendu 1)', v_ledger_count;
  end if;
  raise notice 'OK idempotence confirm_order_paid';
end$$;

-- ---- adjust_points ----------------------------------------------
do $$
declare r record;
begin
  select * into r from adjust_points('d0000000-0000-0000-0000-000000000001', 130);
  if r.points_balance <> 150 then
    raise exception 'FAIL adjust: attendu 150, obtenu %', r.points_balance;
  end if;
  raise notice 'OK adjust_points: balance=%', r.points_balance;
end$$;

-- ---- redeem_reward : "Boisson chaude offerte" (100 pts) ----------
do $$
declare r record; v_reward uuid;
begin
  select id into v_reward from rewards
   where cafe_id = '11111111-1111-1111-1111-111111111111' and cost_points = 100 limit 1;
  select * into r from redeem_reward('d0000000-0000-0000-0000-000000000001', v_reward);
  if r.points_balance <> 50 then
    raise exception 'FAIL redeem: attendu 50, obtenu %', r.points_balance;
  end if;
  raise notice 'OK redeem_reward: balance=%', r.points_balance;
end$$;

-- ---- redeem : solde insuffisant doit échouer ---------------------
do $$
declare v_reward uuid; v_failed boolean := false;
begin
  select id into v_reward from rewards
   where cafe_id = '11111111-1111-1111-1111-111111111111' and cost_points = 500 limit 1;
  begin
    perform redeem_reward('d0000000-0000-0000-0000-000000000001', v_reward);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'FAIL redeem: dépense au-delà du solde autorisée';
  end if;
  raise notice 'OK redeem garde-fou solde insuffisant';
end$$;

-- ---- redeem : récompense d'un autre café doit échouer ------------
do $$
declare v_reward uuid; v_failed boolean := false;
begin
  select id into v_reward from rewards
   where cafe_id = '22222222-2222-2222-2222-222222222222' limit 1;
  begin
    perform redeem_reward('d0000000-0000-0000-0000-000000000001', v_reward);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'FAIL redeem: récompense inter-café autorisée';
  end if;
  raise notice 'OK redeem garde-fou inter-café';
end$$;

-- ---- expire_points ----------------------------------------------
do $$
declare v_n int;
begin
  -- Rends le client inactif depuis > 12 mois.
  update customers set last_activity_at = now() - interval '13 months'
   where id = 'd0000000-0000-0000-0000-000000000001';
  select expire_points() into v_n;
  if v_n < 1 then
    raise exception 'FAIL expire: aucun client expiré';
  end if;
  if (select points_balance from customers where id = 'd0000000-0000-0000-0000-000000000001') <> 0 then
    raise exception 'FAIL expire: solde non remis à zéro';
  end if;
  if not exists (select 1 from points_ledger
                 where customer_id = 'd0000000-0000-0000-0000-000000000001' and reason = 'expire') then
    raise exception 'FAIL expire: pas de ligne ledger expire';
  end if;
  raise notice 'OK expire_points: % client(s)', v_n;
end$$;

-- ---- credit_purchase : gain de points sur un achat en personne ----
do $$
declare r record; v_before int;
begin
  select points_balance into v_before from customers where id = 'd0000000-0000-0000-0000-000000000001';
  -- Achat de 12.50 CHF (1250 cts), 1 pt/CHF → floor(12.50) = 12 pts.
  select * into r from credit_purchase('d0000000-0000-0000-0000-000000000001', 1250);
  if r.points_delta <> 12 then
    raise exception 'FAIL credit_purchase: attendu 12 pts, obtenu %', r.points_delta;
  end if;
  if r.points_balance <> v_before + 12 then
    raise exception 'FAIL credit_purchase: solde incohérent (% vs %)', r.points_balance, v_before + 12;
  end if;
  if not exists (select 1 from points_ledger
                 where customer_id = 'd0000000-0000-0000-0000-000000000001'
                   and reason = 'earn' and order_id is null and delta = 12) then
    raise exception 'FAIL credit_purchase: ligne ledger earn (achat) manquante';
  end if;
  raise notice 'OK credit_purchase: +% pts, solde=%', r.points_delta, r.points_balance;
end$$;

-- ---- credit_purchase : montant invalide doit échouer ----
do $$
declare v_failed boolean := false;
begin
  begin
    perform credit_purchase('d0000000-0000-0000-0000-000000000001', 0);
  exception when others then v_failed := true; end;
  if not v_failed then
    raise exception 'FAIL credit_purchase: montant 0 accepté';
  end if;
  raise notice 'OK credit_purchase garde-fou montant invalide';
end$$;

-- =============================================================
-- ISOLATION RLS : le staff de Brume ne voit QUE Brume.
-- =============================================================

-- Fixture : une commande côté Genève.
insert into customers (id, cafe_id, phone_e164, name)
values ('d0000000-0000-0000-0000-000000000002',
        '22222222-2222-2222-2222-222222222222', '+41790000000', 'Genève');
insert into orders (id, cafe_id, customer_id, order_number, status, pickup_slot,
                    subtotal_cents, total_cents)
values ('e0000000-0000-0000-0000-000000000002',
        '22222222-2222-2222-2222-222222222222',
        'd0000000-0000-0000-0000-000000000002',
        'GEN-TEST-0001', 'paid', now() + interval '1 hour', 400, 410);

do $$
declare v_brume int; v_geneve int;
begin
  -- Se faire passer pour le staff de Brume (authenticated + claim sub).
  set local role authenticated;
  set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  select count(*) into v_brume  from orders where cafe_id = '11111111-1111-1111-1111-111111111111';
  select count(*) into v_geneve from orders where cafe_id = '22222222-2222-2222-2222-222222222222';

  reset role;

  if v_brume < 1 then
    raise exception 'FAIL RLS: le staff Brume ne voit pas ses propres commandes (%).', v_brume;
  end if;
  if v_geneve <> 0 then
    raise exception 'FAIL RLS: le staff Brume voit % commande(s) Genève !', v_geneve;
  end if;
  raise notice 'OK RLS isolation: Brume voit % / Genève voit % (attendu 0)', v_brume, v_geneve;
end$$;

select 'TOUS LES TESTS DB OK' as resultat;
