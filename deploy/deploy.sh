#!/usr/bin/env bash
# =============================================================
# Déploiement Café Brume — helper CLI (à lancer sur une machine
# avec accès internet). Lit deploy/.env.deploy (gitignoré).
#
#   bash deploy/deploy.sh db      # applique full-setup.sql à Supabase
#   bash deploy/deploy.sh env     # pousse les 7 variables sur Vercel (prod)
#   bash deploy/deploy.sh deploy  # vercel deploy --prod
#   bash deploy/deploy.sh all     # db + env + deploy
# =============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

ENVFILE="deploy/.env.deploy"
[ -f "$ENVFILE" ] || { echo "✗ $ENVFILE manquant (copie .env.deploy.example)."; exit 1; }
set -a; . "$ENVFILE"; set +a

VARS=(NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
      STRIPE_SECRET_KEY NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY STRIPE_WEBHOOK_SECRET
      NEXT_PUBLIC_APP_BASE_URL)

do_db() {
  command -v psql >/dev/null || { echo "✗ psql requis (ou colle full-setup.sql dans Supabase)."; exit 1; }
  echo "→ Application du schéma + seed sur Supabase…"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f deploy/full-setup.sql
  echo "✅ Base prête."
}

do_env() {
  command -v vercel >/dev/null || { echo "✗ 'vercel' requis (npm i -g vercel; vercel link)."; exit 1; }
  for v in "${VARS[@]}"; do
    val="${!v:-}"
    [ -n "$val" ] || { echo "  (skip $v : vide)"; continue; }
    vercel env rm "$v" production -y >/dev/null 2>&1 || true
    printf '%s' "$val" | vercel env add "$v" production >/dev/null
    echo "  ✓ $v"
  done
  echo "✅ Variables Vercel poussées (production)."
}

do_deploy() {
  command -v vercel >/dev/null || { echo "✗ 'vercel' requis."; exit 1; }
  echo "→ Déploiement production…"
  vercel deploy --prod
}

case "${1:-all}" in
  db) do_db ;;
  env) do_env ;;
  deploy) do_deploy ;;
  all) do_db; do_env; do_deploy ;;
  *) echo "usage: bash deploy/deploy.sh [db|env|deploy|all]"; exit 1 ;;
esac
