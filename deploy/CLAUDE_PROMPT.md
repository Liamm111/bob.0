# Prompt à coller dans Claude Code (local, avec accès internet)

Ouvre un terminal dans le dossier du repo cloné, lance `claude`, puis colle ceci :

---

Déploie ce repo (Café Brume — Next.js 15 + Supabase + Stripe) en production, en
suivant **`deploy/RUNBOOK.md`**. Fais-le de manière autonome :

1. Vérifie les pré-requis, installe les CLIs manquants (`vercel`, `supabase`).
2. Demande-moi mes accès quand nécessaire (login Vercel/Supabase interactif), ou
   utilise `deploy/.env.deploy` si je l'ai rempli.
3. Applique `deploy/full-setup.sql` à mon projet Supabase.
4. Pousse les 7 variables d'environnement sur Vercel (production) et déploie.
5. Boucle `NEXT_PUBLIC_APP_BASE_URL` sur l'URL Vercel, configure le webhook Stripe
   (`/api/stripe/webhook`, events succeeded/payment_failed/charge.refunded), redeploie.
6. Donne-moi l'URL finale + un récap des liens de test (`/brume`, `/admin`, `/brume/join`)
   et les identifiants staff de démo.

Mode Stripe **test** (carte 4242 4242 4242 4242). Ne committe aucune clé réelle.
Si une étape exige une action manuelle sur un dashboard, dis-le-moi précisément.
