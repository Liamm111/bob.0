# PROGRESS — Café Brume · Click & Collect + Fidélité

Suivi vivant. ✅ fait · 🚧 en cours · ⏳ à faire · ⚠️ point d'attention.

## Vue d'ensemble
Système mono-base, multi-café (`cafe_id`). Rien de spécifique à Brume codé en
dur : tout vient de la base. Intégrations "env-gated" (voir `.env.example`).

## 1. Base de données ✅
- ✅ `supabase/migrations/0001_schema.sql` — schéma source de vérité (verbatim).
- ✅ `0002_points_rpcs.sql` — RPC transactionnelles : `confirm_order_paid`
  (statut paid + décompte créneau + crédit points idempotent), `redeem_reward`,
  `adjust_points`, `expire_points`.
- ✅ `0003_pg_cron_expiry.sql` — job mensuel (fallback Vercel Cron documenté).
- ✅ `supabase/seed.sql` — 2 cafés (brume + geneve), staff, menu (dont alcool
  8.1 %), slots_config, récompenses.
- ✅ `src/types/supabase.ts` — types à la main (générateur = Docker indispo ici).
- ✅ Tests DB : `tests/db/` — migrations rejouables + RPC (earn/redeem/adjust/
  expire, idempotence, garde-fous) + isolation RLS Brume↔Genève. Tous verts.

## 2. Librairies cœur ✅
- ✅ `src/lib/env.ts` — accès env + helpers `*Configured()`.
- ✅ `src/lib/supabase/{service,server}.ts` — service role (server-only) +
  client staff SSR (RLS) + client anon (RPC suivi).
- ✅ `src/lib/cafe.ts` — résolution slug→café, brand tokens, n° de commande.
- ✅ `src/lib/phone.ts` — normalisation E.164 (libphonenumber-js).
- ✅ `src/lib/pricing.ts` — TVA par ligne, TTC, ventilée par taux.
- ✅ `src/lib/slots.ts` — génération créneaux (tz-aware) + capacité/soft-reserve.
- ✅ Tests unitaires `tests/{pricing,phone,slots}.test.ts` — 19 verts.

## 3. Storefront public ⏳
- ⏳ Menu `[cafeSlug]`, panier, sélection créneau, checkout invité, suivi.

## 4. Stripe + points + emails ⏳
- ⏳ PaymentIntent (TWINT+carte), webhook signé, crédit points, emails Resend.

## 5. Back-office ⏳
- ⏳ Auth staff, file temps réel, statuts, CRUD menu/créneaux, rush stop, scan, CSV.

## 6. Wallet ⏳
- ⏳ Apple .pkpass + APNs, Google Loyalty, syncPass, points dormants.

## 7. Ops ⏳
- ⏳ Expiration (route cron), Sentry, PostHog, `.env.example`, README déploiement.

## Décisions / notes
- **Prix TTC** : `menu_items.price_cents` inclut la TVA (modèle suisse) ; la TVA
  est *contenue* et ventilée. `total_cents == subtotal_cents` (pas de frais V1).
- **Points** crédités sur `total_cents` (montant réellement dépensé), floor(CHF ×
  `points_per_currency`).
- **Soft reserve** : commande `pending_payment` tenant une place 10 min ; place
  fermée seulement au webhook Stripe (`confirm_order_paid`).
- **Générateur de types** : nécessite Docker (indispo ici) → types écrits à la
  main, à régénérer via `pnpm db:types` en environnement Supabase.

## Vérification
- `pnpm test` (19 verts) · `bash tests/db/run.sh` (Docker) ou cluster PG local.
- `pnpm typecheck`, `pnpm build` : à repasser au fil de l'implémentation.
