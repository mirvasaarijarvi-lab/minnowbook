#!/usr/bin/env bash
# CI test for the guest link workflow's log guard.
#
# Injects fake backend keys, passwords, database addresses and sign-in
# tokens into every file the workflow prints or scans, runs each printing
# path exactly as the workflow does, and fails if any fake value reaches the
# captured output. Also checks the workflow uploads no artifacts and never
# prints a backend log except through the guard.
set -u
cd "$(dirname "$0")/../.."
GUARD=scripts/ci/guest-link-log-guard.sh
WF=.github/workflows/guest-link-local-backend.yml
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
fail=0
pass() { echo "ok   - $1"; }
bad() { echo "FAIL - $1"; fail=1; }

# Fake values (never real). JWT-shaped so the token pattern is exercised too.
export SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.FAKEserviceSIG123"
export ANON_KEY="eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9xx.FAKEanonSIG4567"
export JWT_SECRET="fake-jwt-secret-super-long-value-0001"
export DB_URL="postgresql://postgres:fakeDbPass99@127.0.0.1:54322/postgres"
export GUEST_LINK_TOKEN="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtldXNlciJ9.FAKEuserTOKEN890"
PASSWORD="ci-guest-portal-password"
BARE_JWT="eyJhbGciOiJIUzI1NiJ9.eyJ1bmtub3duIjoidG9rZW4ifQ.FAKEunknownSIG42"
ALL=("$SERVICE_ROLE_KEY" "$ANON_KEY" "$JWT_SECRET" "$DB_URL" "$GUEST_LINK_TOKEN" "$PASSWORD" "$BARE_JWT" "fakeDbPass99")

# Fake contents for every output path the workflow touches. Secrets appear
# in labelled lines, in unlabelled lines and mid-line, to beat simple filters.
dirty() {
  cat <<EOF
Starting database...
         API URL: http://127.0.0.1:54321
          DB URL: $DB_URL
      JWT secret: $JWT_SECRET
        anon key: $ANON_KEY
service_role key: $SERVICE_ROLE_KEY
connecting to $DB_URL
header Authorization: Bearer $GUEST_LINK_TOKEN
unlabelled value $SERVICE_ROLE_KEY in the middle
login with $PASSWORD failed
raw $ANON_KEY
unknown token $BARE_JWT here
secretless line mentioning $JWT_SECRET
Error: container exited with code 1
EOF
}
for f in supabase-start.log functions-serve.log revoked-test.log; do dirty > "$WORK/$f"; done

leaks() { # $1 = captured output file; prints which fake values leaked
  local out="$1" n=0
  for v in "${ALL[@]}"; do grep -qF -- "$v" "$out" && n=$((n + 1)); done
  grep -qE 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}' "$out" && n=$((n + 1))
  echo "$n"
}

# 1. Each printing path, run as the workflow runs it.
for spec in "failed start:supabase-start.log:40" \
  "function start failure:functions-serve.log:80" \
  "function log on failure:functions-serve.log:200"; do
  name="${spec%%:*}"; rest="${spec#*:}"; file="${rest%%:*}"; lines="${rest#*:}"
  out="$WORK/out-$lines.txt"
  bash "$GUARD" filter "$WORK/$file" "$lines" > "$out" 2>&1
  n=$(leaks "$out")
  [ "$n" = 0 ] && pass "$name output holds no fake secret" || bad "$name output leaked $n fake value(s)"
  grep -q "Error: container exited with code 1" "$out" \
    && pass "$name still shows the error line" || bad "$name dropped the useful error line"
done

# 2. Same, with no known values in the environment: pattern filtering alone
#    must still drop keys, passwords, tokens and database addresses.
out="$WORK/out-noenv.txt"
env -u SERVICE_ROLE_KEY -u ANON_KEY -u JWT_SECRET -u DB_URL -u GUEST_LINK_TOKEN \
  bash "$GUARD" filter "$WORK/supabase-start.log" 40 > "$out" 2>&1
n=$(leaks "$out")
[ "$n" = 0 ] && pass "filter works without known values" || bad "filter without known values leaked $n"

# 3. The scan step fails on each dirty file and names no value.
for f in revoked-test.log functions-serve.log supabase-start.log; do
  out="$WORK/scan-$f.txt"
  if bash "$GUARD" scan "$WORK/$f" > "$out" 2>&1; then bad "scan passed a dirty $f"
  else pass "scan fails on dirty $f"; fi
  [ "$(leaks "$out")" = 0 ] && pass "scan message for $f names no secret" || bad "scan message for $f leaked"
done
# One fake value at a time, each on its own, must be caught.
missed=0
for i in "${!ALL[@]}"; do
  printf 'line %s end\n' "${ALL[$i]}" > "$WORK/one.log"
  bash "$GUARD" scan "$WORK/one.log" > /dev/null 2>&1 && { bad "scan missed fake value #$i"; missed=1; }
done
[ "$missed" = 0 ] && pass "scan catches every fake value on its own"
printf 'test ok | 1 passed | 0 failed\n' > "$WORK/clean.log"
bash "$GUARD" scan "$WORK/clean.log" > /dev/null 2>&1 && pass "scan passes a clean log" || bad "scan failed a clean log"

# 4. Workflow structure: no artifacts, no unguarded log printing.
grep -qE 'upload-artifact|actions/cache/save' "$WF" && bad "workflow uploads artifacts" || pass "workflow uploads no artifacts"
unguarded=$(grep -nE '(cat|tail|head|less|more)[^|]*/tmp/(supabase-start|functions-serve|revoked-test)\.log' "$WF" | grep -v 'guest-link-log-guard' || true)
[ -z "$unguarded" ] && pass "every backend log is printed only through the guard" || { bad "unguarded log print:"; echo "$unguarded"; }
grep -q 'supabase start[^>]*> /tmp/supabase-start.log 2>&1' "$WF" && pass "startup output goes to a private file" || bad "startup output is not redirected"
grep -q 'guest-link-log-guard.sh scan' "$WF" && pass "workflow runs the final scan" || bad "workflow has no final scan"
grep -q 'rm -f /tmp/supabase-start.log' "$WF" && pass "cleanup deletes the startup log" || bad "cleanup keeps the startup log"
# Anything echoed that contains a credential variable must be a mask command.
echoes=$(grep -nE 'echo .*\$\{?(TOKEN|SERVICE_ROLE_KEY|ANON_KEY|JWT_SECRET|DB_URL|value)\b' "$WF" \
  | grep -vE '::add-mask::|>> "\$GITHUB_ENV"' || true)
[ -z "$echoes" ] && pass "credentials are only echoed as mask commands" || { bad "credential echoed:"; echo "$echoes"; }

[ "$fail" = 0 ] && echo "All log guard checks passed." || echo "Log guard checks FAILED."
exit $fail
