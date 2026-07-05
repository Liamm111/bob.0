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
