#!/usr/bin/env bash
# =============================================================
# Vérifie que les migrations rejouent et que RPC + RLS marchent.
# Lance un Postgres jetable en docker, applique bootstrap +
# migrations + seed + tests. Code retour != 0 si un test échoue.
#
# Usage: bash tests/db/run.sh
# =============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTAINER="brume-db-test"
PGPASSWORD="postgres"

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

echo "→ Démarrage Postgres 16 (docker)…"
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD="$PGPASSWORD" \
  -e POSTGRES_DB=postgres \
  -p 55432:5432 \
  postgres:16 >/dev/null

echo "→ Attente de la disponibilité…"
for i in $(seq 1 30); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done

run() { docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }

echo "→ Bootstrap (rôles + schéma auth)…"
run < "$ROOT/tests/db/bootstrap.sql" >/dev/null

echo "→ Migrations…"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "   • $(basename "$f")"
  run < "$f" >/dev/null
done

echo "→ Seed…"
run < "$ROOT/supabase/seed.sql" >/dev/null

echo "→ Tests RPC + RLS…"
run < "$ROOT/tests/db/rpc_and_rls.test.sql"

echo "✅ DB OK"
