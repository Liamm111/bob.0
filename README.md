# Café Brume — Click & Collect + Fidélité

Système de commande en ligne « Click & Collect + carte de fidélité Wallet »,
**mono-base, multi-café** (tout est scopé par `cafe_id`). Le même code sert
Café Brume et, sans réécriture, un second café — tout vient de la base
(nom, couleurs, horaires, capacités, TVA, récompenses).

Le client commande, paie d'avance (**TWINT / carte**), choisit un créneau de
retrait, est identifié par son **téléphone (E.164)**, gagne des **points**
(1 pt/CHF), ajoute sa carte à **Apple ou Google Wallet**, et se voit appliquer
ses **récompenses au scan en boutique**.

## Stack
Next.js 15 (App Router, Server Actions) · TypeScript strict · Supabase
(Postgres/RLS/Realtime/Auth staff) · Stripe (PaymentIntents, TWINT+carte,
webhooks) · Resend + React Email · Apple Wallet (.pkpass + APNs) + Google
Wallet (Loyalty REST) · libphonenumber-js · Sentry + PostHog · Vercel.

## Architecture (2 niveaux d'accès)
- **Staff** (`/admin`) : authentifié (Supabase Auth), tout passe par la **RLS**
  (table `staff` + `is_cafe_staff`) → un membre ne voit que SON café.
- **Client** : jamais authentifié, **zéro policy anon**. Toutes les opérations
  client (menu, checkout, crédit de points) tournent en **code serveur avec la
  service role key**, scopées par `cafe_id`. Le suivi de commande passe par la
  RPC `get_order_by_token` (security definer).

Règles clés : prix/TVA **recalculés serveur** (TVA par ligne, 2.6 % / 8.1 %,
prix TTC) ; capacité de créneau décomptée **au paiement confirmé** (webhook),
réservation soft 10 min pendant le checkout ; points crédités/dépensés/expirés
en **transactions Postgres** (`confirm_order_paid`, `redeem_reward`,
`adjust_points`, `expire_points`) ; dépense de points **uniquement au scan**.

## Démarrage local
```bash
pnpm install
cp .env.example .env.local      # renseigner Supabase (+ intégrations voulues)

# Base : appliquer les migrations + le seed (Supabase CLI + Docker)
pnpm supabase start             # lance Postgres/Auth/Realtime locaux
pnpm db:reset                   # applique supabase/migrations/* puis seed.sql
pnpm db:types                   # (re)génère src/types/supabase.ts

pnpm dev                        # http://localhost:3000
```
Comptes staff de démo (voir `supabase/seed.sql`) :
`staff@brume.click` / `brume-dev-password` · `staff@geneve.click` / `geneve-dev-password`.

## Tests & vérification
```bash
pnpm test          # tests unitaires (TVA, téléphone, créneaux) — 19 verts
pnpm typecheck     # tsc strict
pnpm build         # build de production
bash tests/db/run.sh   # migrations rejouables + RPC + isolation RLS (Docker)
```
`tests/db/` monte un Postgres jetable, applique bootstrap + migrations + seed,
puis vérifie les RPC fidélité (earn/redeem/adjust/expire, idempotence,
garde-fous) et l'**isolation RLS** (le staff Brume ne voit jamais Genève).

## Intégrations (env-gated)
Chaque intégration se désactive proprement si ses variables manquent
(voir `.env.example`) — l'app démarre toujours.
- **Stripe** : configurer le webhook sur `POST /api/stripe/webhook`
  (événements `payment_intent.succeeded`, `payment_intent.payment_failed`,
  `charge.refunded`). Le webhook est vérifié par signature = source de vérité.
- **Resend** : emails confirmation / prête / annulation (envoyés si le client a
  fourni un email au checkout).
- **Apple Wallet** : cert Pass Type ID + clé + WWDR + APNs (.p8). Émission :
  `GET /api/wallet/apple/{track_token}`. Web service PassKit sous
  `/api/wallet/apple/v1/...`.
- **Google Wallet** : compte de service + issuer id. Émission :
  `GET /api/wallet/google/{track_token}` (redirige vers "Save to Google Wallet").
- **Expiration** : `pg_cron` (migration 0003) si dispo, sinon **Vercel Cron**
  → `GET /api/cron/expire` (protégé par `CRON_SECRET`), voir `vercel.json`.

## Déploiement (Vercel)
1. Créer un projet Supabase, appliquer `supabase/migrations/*` (via `supabase db
   push`) et le seed adapté au(x) café(s) réel(s).
2. Renseigner toutes les variables d'environnement (`.env.example`) dans Vercel.
3. Déployer. Configurer le webhook Stripe vers `/api/stripe/webhook`.
4. Le cron d'expiration est déclaré dans `vercel.json`.

## nLPD (Suisse)
Données client minimales (prénom, téléphone, email facultatif). Consentement
marketing distinct, **décoché par défaut**. Liens de suivi via `track_token`
(UUID non devinable), aucune énumération d'ID. Suppression = anonymisation des
commandes (historique compta conservé sans PII).

Voir `PROGRESS.md` pour l'état détaillé et les points d'attention.
