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
