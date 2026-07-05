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
