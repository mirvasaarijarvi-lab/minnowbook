#!/usr/bin/env bash
#
# Rollback regression test for the reservations indexes migration.
#
# Boots against a Postgres reachable via $DATABASE_URL (set by the CI job's
# `services: postgres`). Creates a minimal `public.reservations` stub with
# only the columns the forward migration's indexes reference, then runs:
#
#   1. forward  — apply supabase/migrations/<TIMESTAMP>_<slug>.sql
#                 assert all 11 expected indexes exist
#   2. down     — apply db/rollback/<TIMESTAMP>_<slug>.down.sql
#                 assert all 11 expected indexes are gone
#                 assert pg_trgm extension is still installed
#   3. forward  — apply forward migration again
#                 assert all 11 expected indexes exist again
#
# Any failure exits non-zero and prints the offending pg_indexes row.

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set (postgres connection string)}"

FORWARD_FILE="supabase/migrations/20260511101454_05115563-3e3d-4403-8e0f-5979fca38544.sql"
DOWN_FILE="db/rollback/20260511101454_05115563-3e3d-4403-8e0f-5979fca38544.down.sql"

# Indexes the forward migration creates. The schema-gate also asserts
# idx_reservations_guest_search_trgm, idx_reservations_site_id, and
# idx_reservations_discount_code_id, but those come from *other* forward
# migrations (20260511102239 / 20260511102504 / 20260303093523) and are
# intentionally NOT in this set — this script only verifies the rollback
# of the one migration it pairs with.
EXPECTED_INDEXES=(
  idx_reservations_tenant_date
  idx_reservations_tenant_status
  idx_reservations_tenant_type
  idx_reservations_tenant_invoiced
  idx_reservations_tenant_checkout
  idx_reservations_tenant_email
  idx_reservations_guest_name_trgm
  idx_reservations_guest_email_trgm
  idx_reservations_guest_phone_trgm
  idx_reservations_capacity_lookup
)

psql_run() {
  PGPASSWORD="${PGPASSWORD:-}" psql "$DATABASE_URL" \
    --set ON_ERROR_STOP=1 \
    --quiet \
    --no-psqlrc \
    "$@"
}

assert_index_present() {
  local name="$1"
  local count
  count=$(psql_run -tAc "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename='reservations' AND indexname='${name}'")
  if [ "$count" != "1" ]; then
    echo "::error::Expected index ${name} to exist, but pg_indexes count=${count}"
    psql_run -c "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='reservations' ORDER BY indexname"
    return 1
  fi
}

assert_index_absent() {
  local name="$1"
  local count
  count=$(psql_run -tAc "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename='reservations' AND indexname='${name}'")
  if [ "$count" != "0" ]; then
    echo "::error::Expected index ${name} to be gone after rollback, but pg_indexes count=${count}"
    return 1
  fi
}

assert_extension_present() {
  local name="$1"
  local count
  count=$(psql_run -tAc "SELECT count(*) FROM pg_extension WHERE extname='${name}'")
  if [ "$count" != "1" ]; then
    echo "::error::Expected extension ${name} to remain installed after rollback (down file should not drop it)"
    return 1
  fi
}

echo "=== Step 0: stub public.reservations table with referenced columns ==="
psql_run <<'SQL'
DROP TABLE IF EXISTS public.reservations CASCADE;
CREATE TABLE public.reservations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  date             date NOT NULL,
  status           text NOT NULL DEFAULT 'pending',
  reservation_type text NOT NULL DEFAULT 'restaurant',
  is_invoiced      boolean NOT NULL DEFAULT false,
  check_out_date   date,
  guest_email      text,
  guest_name       text,
  guest_phone      text
);
SQL

echo
echo "=== Step 1a: apply forward migration ==="
psql_run -f "$FORWARD_FILE"

echo "=== Step 1b: assert all expected indexes exist ==="
for idx in "${EXPECTED_INDEXES[@]}"; do
  assert_index_present "$idx"
done
echo "OK: ${#EXPECTED_INDEXES[@]} indexes present after forward migration"

echo
echo "=== Step 2a: apply down migration ==="
psql_run -f "$DOWN_FILE"

echo "=== Step 2b: assert all expected indexes are gone ==="
for idx in "${EXPECTED_INDEXES[@]}"; do
  assert_index_absent "$idx"
done
echo "OK: ${#EXPECTED_INDEXES[@]} indexes removed after down migration"

echo "=== Step 2c: assert pg_trgm extension was preserved ==="
assert_extension_present pg_trgm
echo "OK: pg_trgm still installed (down migration correctly left shared deps alone)"

echo
echo "=== Step 3a: re-apply forward migration ==="
psql_run -f "$FORWARD_FILE"

echo "=== Step 3b: assert all expected indexes exist again ==="
for idx in "${EXPECTED_INDEXES[@]}"; do
  assert_index_present "$idx"
done
echo "OK: forward migration is idempotent and rollback is reversible"

echo
echo "=== Rollback regression test PASSED ==="
