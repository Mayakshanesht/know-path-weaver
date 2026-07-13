#!/usr/bin/env bash
#
# Applies the pending schema to the live database and verifies the result.
#
# Reads SUPABASE_DB_URL from .env (gitignored). Everything in APPLY_PENDING.sql is
# idempotent, so a failed half-run can simply be re-run.
#
#   ./scripts/apply-pending.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env file found." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env
set +a

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  cat >&2 <<'MSG'
SUPABASE_DB_URL is not set in .env

Get it from: Supabase > Project Settings > Database > Connection string > Session pooler
Then add this line to .env (replace the password):

  SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres

Use the Session pooler, not the direct connection: the direct host is IPv6-only on
newer projects and will time out.
MSG
  exit 1
fi

echo "==> Applying supabase/APPLY_PENDING.sql"
# ON_ERROR_STOP so a failure is loud and the run halts rather than half-applying.
psql "$SUPABASE_DB_URL" \
  --set ON_ERROR_STOP=1 \
  --quiet \
  --file supabase/APPLY_PENDING.sql

echo
echo "==> Verifying"
psql "$SUPABASE_DB_URL" --quiet --no-align --tuples-only <<'SQL'
SELECT
  'enrollments.billing_country  ' ||
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='enrollments' AND column_name='billing_country'
  ) THEN 'OK  (checkout fixed)' ELSE 'MISSING' END
UNION ALL SELECT
  'invoices table              ' ||
  CASE WHEN to_regclass('public.invoices') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL SELECT
  'marketing_campaigns table   ' ||
  CASE WHEN to_regclass('public.marketing_campaigns') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL SELECT
  'marketing_posts table       ' ||
  CASE WHEN to_regclass('public.marketing_posts') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL SELECT
  'articles table              ' ||
  CASE WHEN to_regclass('public.articles') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL SELECT
  'reorder_entities()          ' ||
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='reorder_entities'
  ) THEN 'OK' ELSE 'MISSING' END
UNION ALL SELECT
  'invoices storage bucket     ' ||
  CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id='invoices')
       THEN 'OK' ELSE 'MISSING' END;
SQL

echo
echo "Done."
