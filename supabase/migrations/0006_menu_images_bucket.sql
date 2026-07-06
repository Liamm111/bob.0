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
