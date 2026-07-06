# PROGRESS — Café Brume · Click & Collect + Fidélité

Suivi vivant. fait / en cours / à faire / point d'attention.

## Storefront photo-forward (jour 2)
- ✅ Cartes produit orientées photo (`MenuBrowser`) : `image_url` (repli dégradé +
  monogramme), badge « Nouveau », puces allergènes, +/stepper, état rupture.
- ✅ Upload photo back-office : bucket Storage `menu-images` (migration 0006, défensive),
  action `uploadMenuImage` (service role, scopé café), champ photo + URL dans l'éditeur menu.

## Backlog V2 — Options / Upsell (planifié, non construit)
Objectif : fiche produit « façon Cojean » (choix, suppléments, suggestions).
- **Schéma (migration future)** :
  - `menu_option_groups(id, cafe_id, menu_item_id, name, min_select, max_select, sort_order)`
    — ex. « Choisissez votre pain » (min 1 / max 1).
  - `menu_options(id, group_id, name, price_delta_cents, is_default, sort_order)`
    — ex. « Sans gluten +1.50 ».
  - `menu_item_upsells(cafe_id, menu_item_id, suggested_item_id, sort_order)`
    — « souvent pris ensemble » / « un dessert avec ça ? ».
- **Commande** : `order_items.options_snapshot jsonb` (choix figés) + prix unitaire ajusté
  des deltas. Le calcul TVA serveur (`priceOrder`) intègre les deltas d'options.
- **UI** : fiche produit `/[cafeSlug]/item/[id]` (groupes = radios/checkboxes selon min/max,
  upsells en bas), remplace l'ajout direct pour les articles à options.
- **Back-office** : CRUD des groupes/options + gestion des suggestions.
- **RLS/scoping** : tout scopé `cafe_id` comme le reste ; validation serveur des options
  choisies (jamais de prix client).
- Effort estimé : ~1 migration + fiche produit + calcul prix + CRUD back-office.

---


## Ajout — Fidélité en boutique (jour 2)
- ✅ **Inscription self-service** : page publique `/[slug]/join` (prénom + tél + consentement)
  → `enrollCustomer` (`src/actions/enroll.ts`) → carte + boutons Wallet. QR comptoir à
  imprimer : `/[slug]/join/qr`.
- ✅ **Émission Wallet par pass_serial** (hors commande) : `issueAppleForSerial` /
  `issueGoogleForSerial` + endpoints `/api/wallet/{apple,google}/serial/[passSerial]`.
  `mintPassSerial` attribue le serial sans figer la plateforme.
- ✅ **Gain de points en caisse** (sans POS) : RPC `credit_purchase` (migration 0005,
  `earn`, order_id null) ; écran back-office `/admin/loyalty` (téléphone → créer si absent →
  montant → points auto → `syncPass`). Test DB inclus.
- ⚠️ **POS** : non intégré (aucun POS choisi). `credit_purchase` est la couture : un POS
  appellera la même RPC en V2.

---


Système mono-base, multi-café (`cafe_id`). Rien de spécifique à Brume codé en
dur : tout vient de la base. Intégrations **env-gated** (voir `.env.example`).

Vérifié : `pnpm test` (19 verts) · `pnpm typecheck` · `pnpm build` ·
`tests/db/` (migrations rejouables + RPC + isolation RLS).

## 1. Base de données ✅
- ✅ `0001_schema.sql` — schéma source de vérité (verbatim).
- ✅ `0002_points_rpcs.sql` — `confirm_order_paid` (paid + décompte créneau +
  crédit points idempotent + flag surréservation), `redeem_reward`,
  `adjust_points`, `expire_points`. + grant `get_order_by_token` au service role.
- ✅ `0003_pg_cron_expiry.sql` — job mensuel (fallback Vercel Cron).
- ✅ `0004_wallet_registrations.sql` — table additive pour les appareils APNs
  (Apple Wallet impose un web service qui mémorise les enregistrements).
- ✅ `supabase/seed.sql` — 2 cafés (brume + geneve), staff, menu (dont 8.1 %),
  slots_config, récompenses.
- ✅ `src/types/supabase.ts` — types à la main (générateur = Docker/CDN indispo ici).
- ✅ `tests/db/` — bootstrap + tests RPC + RLS. Tous verts.

## 2. Librairies cœur ✅
- ✅ env-gating, clients Supabase (service role server-only · staff SSR RLS),
  résolution café, normalisation E.164, TVA par ligne TTC, créneaux tz-aware.
- ✅ Tests unitaires (TVA, téléphone, créneaux) — 19 verts.

## 3. Storefront public ✅
- ✅ Menu `[cafeSlug]` (rupture via `is_available`), panier localStorage
  (notes/qty), sélection de créneau (capacité + soft-reserve), checkout invité
  (prénom + tél + email facultatif + consentement marketing décoché), Stripe
  Payment Element (TWINT + carte), suivi `/track/[token]` via RPC.

## 4. Stripe + points + emails ✅
- ✅ Webhook signé = source de vérité : succeeded → `confirm_order_paid` →
  syncPass + email ; failed/canceled → libère le créneau ; refunded → email.
- ✅ Resend + React Email brandés (confirmation / prête / annulation), envoyés
  si email fourni.

## 5. Back-office ✅
- ✅ Auth staff (login/middleware), file **temps réel** (Realtime), transitions
  de statut, email "prête" au passage ready, CRUD menu + toggle rupture,
  config créneaux, **rush stop**, **scan** (pass → solde → récompense →
  `redeem_reward`) + ajustement manuel, **export CSV** compta.

## 6. Wallet ✅
- ✅ Apple `.pkpass` storeCard signé (node-forge PKCS#7, icônes PNG générées),
  APNs push, web service PassKit complet (register/list/latest/log).
- ✅ Google Loyalty (class + object create/patch, lien "Save to Google Wallet").
- ✅ `syncPass` (fan-out Apple+Google) sur tout changement de solde ; points
  dormants hérités à l'ajout du pass (émission lit le solde courant).

## 7. Ops ✅
- ✅ Expiration : `pg_cron` + route `/api/cron/expire` (protégée `CRON_SECRET`)
  + `vercel.json`.
- ✅ Sentry (wrappers env-gated) + PostHog (client + serveur env-gated).
- ✅ `.env.example` complet, `README.md` de déploiement.

## Décisions / notes
- **Prix TTC** : `menu_items.price_cents` TVA incluse (modèle suisse) ; TVA
  *contenue*, ventilée par taux ; `total_cents == subtotal_cents` (pas de frais).
- **Points** crédités sur `total_cents` (montant réellement dépensé),
  floor(CHF × `points_per_currency`). Débit **uniquement au scan**.
- **Soft reserve** : commande `pending_payment` tenant une place 10 min ; place
  fermée seulement au webhook (`confirm_order_paid`), avec re-check ; un
  paiement réussi est toujours honoré (flag `overbooked` loggé si dépassement).
- **@supabase/ssr** ne propage pas le générique `Database` au typage
  `.from()/.rpc()` → tout le typage passe par `SupabaseClient<Database>`
  (cast dans `staffClient`) et les RPC transitent par le service role.

## ⚠️ Points d'attention (à finaliser en environnement réel)
- ⚠️ **Types Supabase** écrits à la main (Docker/CDN du générateur bloqués ici).
  Régénérer via `pnpm db:types` sur un vrai projet pour rester synchro.
- ⚠️ **Sentry** : wrappers `captureException/Message` en place, mais l'init
  complet (fichiers `sentry.*.config.ts` / instrumentation) reste à générer via
  l'assistant `@sentry/nextjs` au moment du déploiement (DSN requis).
- ⚠️ **Icônes Apple Wallet** générées à la volée (carrés unis) : suffisantes
  pour un pass fonctionnel ; remplacer par le vrai logo (via `brand_tokens`)
  pour la prod.
- ⚠️ Intégrations non exécutées "en vrai" ici (pas de secrets/réseau) :
  vérifiées par typecheck + build + tests. Faire un run sandbox (Stripe test,
  Apple/Google Wallet, Resend) avant mise en prod.
- ⚠️ **Middleware Edge** : avertissement build `process.version` (via
  @supabase/ssr). Non bloquant ; à surveiller, éventuellement forcer le runtime
  Node si besoin.

## Definition of Done — état
Parcours de bout en bout (commande → paiement → points → pass → scan →
récompense) implémenté et cohérent avec le schéma ; isolation multi-café
vérifiée (RLS) ; TVA ventilée par reçu ; aucune donnée client en anon ;
`.env.example` + migrations rejouables + `PROGRESS.md` complets. Reste : un run
live avec vrais secrets (post-déploiement).
