# RUNBOOK — Déploiement autonome (CLI)

Procédure exécutable en ligne de commande sur une machine avec **vrai accès internet**
(l'ordinateur de l'utilisateur, ou un Claude Code local). Résultat : une URL Vercel live
qui parle à un projet Supabase, paiement Stripe en mode test.

> Secrets : remplis `deploy/.env.deploy` (copie de `.env.deploy.example`, **gitignoré**).
> Ne colle jamais de clé réelle dans un fichier committé.

## 0. Pré-requis
```bash
node -v            # ≥ 18
npm i -g vercel supabase   # CLIs Vercel + Supabase
# (psql utile pour appliquer le SQL ; sinon utiliser l'éditeur SQL Supabase)
corepack enable && pnpm -v # ou npm ci
```

## 1. Supabase — base de données
1. Crée un projet sur https://supabase.com (région Frankfurt). Récupère, dans
   **Project Settings → Database**, la *Connection string* (URI) → `SUPABASE_DB_URL`.
2. Applique le schéma + seed (tout est dans `deploy/full-setup.sql`) :
   ```bash
   psql "$SUPABASE_DB_URL" -f deploy/full-setup.sql
   ```
   (ou : SQL Editor → coller `deploy/full-setup.sql` → Run)
3. Dans **Project Settings → API**, copie :
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Stripe — paiement (mode test)
- https://dashboard.stripe.com (mode **Test**) → *Developers → API keys* :
  - Secret key `sk_test_…` → `STRIPE_SECRET_KEY`
  - Publishable key `pk_test_…` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Webhook : voir étape 5 (après avoir l'URL Vercel).

## 3. Vercel — variables d'env + déploiement
```bash
vercel login
vercel link          # lie le dossier au (nouveau) projet Vercel

# Pousse les variables (script fourni, lit deploy/.env.deploy) :
bash deploy/deploy.sh env      # ajoute les 7 variables en production
vercel deploy --prod           # 1er déploiement → renvoie l'URL
```

## 4. Boucler l'URL de base
```bash
# Mets NEXT_PUBLIC_APP_BASE_URL = l'URL Vercel obtenue, puis redeploy :
vercel env rm NEXT_PUBLIC_APP_BASE_URL production -y 2>/dev/null || true
printf '%s' "https://TON-APP.vercel.app" | vercel env add NEXT_PUBLIC_APP_BASE_URL production
vercel deploy --prod
```

## 5. Webhook Stripe
```bash
# Option CLI (garde le terminal ouvert pour la vérif locale) OU via dashboard :
# Dashboard → Developers → Webhooks → Add endpoint
#   URL: https://TON-APP.vercel.app/api/stripe/webhook
#   Events: payment_intent.succeeded, payment_intent.payment_failed, charge.refunded
# Copie le Signing secret (whsec_…) :
printf '%s' "whsec_…" | vercel env add STRIPE_WEBHOOK_SECRET production
vercel deploy --prod
```

## 6. Tester le flow 📱
- Menu : `https://TON-APP.vercel.app/brume`
- Commander → créneau → prénom+tél(+email) → payer avec la carte test `4242 4242 4242 4242`
  (date future, CVC quelconque) → page de suivi (le webhook confirme + crédite les points).
- Back-office : `https://TON-APP.vercel.app/admin` — `staff@brume.click` / `brume-dev-password`.
- Fidélité caisse : `/admin/loyalty` · Menu+photos : `/admin/menu` · Inscription : `/brume/join`.

> TWINT n'apparaît qu'avec un compte Stripe **live** suisse. En test : carte 4242.
> Si le login staff échoue : Supabase → Authentication → Users → reset password de `staff@brume.click`.
