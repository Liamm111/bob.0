# Déployer Café Brume et tester le flow sur ton téléphone

Objectif : une URL live pour tester **menu → panier → créneau → paiement →
confirmation → back-office → fidélité**. ~20 min, faisable depuis le téléphone.

Il te faut 3 comptes gratuits : **Supabase** (base), **Stripe** (paiement, mode test),
**Vercel** (hébergement, connecté à ton GitHub).

---

## 1) Supabase — la base de données (5 min)
1. Va sur **supabase.com** → *New project* (note le mot de passe DB).
2. Ouvre **SQL Editor** → *New query* → colle **tout le contenu de `deploy/full-setup.sql`**
   (schéma + fidélité + bucket photos + seed Brume/Genève) → *Run*.
3. Va dans **Project Settings → API** et copie :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (secret !)

## 2) Stripe — le paiement (mode test, 3 min)
1. **dashboard.stripe.com** → reste en **mode Test** (interrupteur en haut).
2. *Developers → API keys* → copie :
   - `Secret key` (sk_test_…) → `STRIPE_SECRET_KEY`
   - `Publishable key` (pk_test_…) → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - (Le webhook se configure à l'étape 4.)

## 3) Vercel — l'hébergement (5 min)
1. **vercel.com** → *Add New → Project* → *Import* ton dépôt GitHub (Brume/bob.0).
2. Dans **Environment Variables**, ajoute (minimum pour le flow) :
   ```
   NEXT_PUBLIC_SUPABASE_URL         = …
   NEXT_PUBLIC_SUPABASE_ANON_KEY    = …
   SUPABASE_SERVICE_ROLE_KEY        = …
   STRIPE_SECRET_KEY                = sk_test_…
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_test_…
   STRIPE_WEBHOOK_SECRET            = whsec_test_placeholder   (mis à jour étape 4)
   NEXT_PUBLIC_APP_BASE_URL         = https://TON-APP.vercel.app  (mis à jour après le 1er deploy)
   ```
3. **Deploy**. Tu obtiens une URL `https://….vercel.app`.
4. Reviens dans les env vars, mets `NEXT_PUBLIC_APP_BASE_URL` = cette URL → **Redeploy**.

## 4) Webhook Stripe (2 min)
1. Stripe (mode Test) → *Developers → Webhooks → Add endpoint*.
2. URL : `https://TON-APP.vercel.app/api/stripe/webhook`
3. Événements : `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`.
4. Copie le **Signing secret** (whsec_…) → mets-le dans Vercel (`STRIPE_WEBHOOK_SECRET`) → **Redeploy**.

---

## Tester le flow 📱
- **Menu** : `https://TON-APP.vercel.app/brume`
- Ajoute des articles → **Commander** → choisis un créneau → prénom + téléphone (+ email si tu veux la confirmation) → **Payer**.
  - Carte de test : `4242 4242 4242 4242`, date future, CVC quelconque.
- Tu es redirigé vers la page de **suivi** ; le webhook passe la commande en *payée* et crédite les points.
- **Back-office** : `https://TON-APP.vercel.app/admin`
  - Login : `staff@brume.click` / `brume-dev-password`
  - File des commandes en temps réel, changement de statut, **rush stop**.
  - **Fidélité en caisse** : `/admin/loyalty` (téléphone → montant → points).
  - **Menu + photos** : `/admin/menu` (upload des vraies photos → le storefront devient « alléchant »).
- **Inscription fidélité self-service** : `https://TON-APP.vercel.app/brume/join` (QR comptoir : `/brume/join/qr`).

## Optionnel (pas requis pour le flow)
- **Emails** : `RESEND_API_KEY`, `EMAIL_FROM`.
- **Wallet Apple/Google** : voir `.env.example` (certificats). Sans ça, les boutons Wallet sont juste masqués.
- **Expiration points** : `CRON_SECRET` (le cron est déclaré dans `vercel.json`).

> ⚠️ Mode test : **TWINT n'apparaît qu'en compte live suisse** — en test, utilise la carte
> `4242…`. En prod (compte Stripe CH activé), TWINT s'ajoute automatiquement.

> Si le login staff échoue : Supabase → *Authentication → Users* → `staff@brume.click` →
> *Reset password* (ou recrée l'utilisateur), puis relie-le dans la table `staff`.
