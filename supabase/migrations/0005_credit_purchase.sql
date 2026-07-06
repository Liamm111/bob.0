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
