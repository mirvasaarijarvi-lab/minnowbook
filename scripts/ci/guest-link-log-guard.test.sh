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

# 3b. Encoded and escaped copies of every fake value. Each form is planted
#     in an unlabelled line, so only decoding can catch it. The filter must
#     drop it (for every output path), and the scan must fail on it.
encode_forms() { # $1 = value; prints "form<TAB>encoded" per line
  python3 - "$1" <<'PY'
import json, sys
from urllib.parse import quote
v = sys.argv[1]
forms = {
    "url-encoded": quote(v, safe=""),
    "double url-encoded": quote(quote(v, safe=""), safe=""),
    "every byte url-encoded": "".join("%%%02X" % b for b in v.encode()),
    "every byte url-encoded, lowercase": "".join("%%%02x" % b for b in v.encode()),
    "JSON-escaped": json.dumps(v)[1:-1].replace("/", "\\/"),
    "JSON string in JSON": json.dumps(json.dumps({"v": v}))[1:-1],
    "unicode-escaped": "".join("\\u%04x" % ord(c) for c in v),
    "hex-escaped": "".join("\\x%02x" % ord(c) for c in v),
    "backslash-escaped": "".join("\\" + c if not c.isalnum() else c for c in v),
    "HTML-escaped": v.replace("&", "&amp;").replace("/", "&#x2F;").replace('"', "&quot;"),
}
for name, enc in forms.items():
    print(f"{name}\t{enc}")
PY
}
enc_missed=0; enc_total=0
for i in "${!ALL[@]}"; do
  while IFS=$'\t' read -r form enc; do
    [ "$enc" = "${ALL[$i]}" ] && continue # form leaves this value unchanged
    enc_total=$((enc_total + 1))
    printf 'Error: container exited with code 1\nupstream said: %s (retrying)\n' "$enc" > "$WORK/enc.log"
    for lines in 40 80 200; do
      out="$WORK/enc-out.txt"
      bash "$GUARD" filter "$WORK/enc.log" "$lines" > "$out" 2>&1
      if grep -qF -- "$enc" "$out" || [ "$(leaks "$out")" != 0 ]; then
        bad "filter ($lines lines) let a $form fake value #$i through"; enc_missed=1
      fi
      grep -q "Error: container exited with code 1" "$out" \
        || { bad "filter dropped the error line next to a $form value"; enc_missed=1; }
    done
    if bash "$GUARD" scan "$WORK/enc.log" > "$WORK/enc-scan.txt" 2>&1; then
      bad "scan missed a $form fake value #$i"; enc_missed=1
    elif grep -qF -- "$enc" "$WORK/enc-scan.txt"; then
      bad "scan message repeats a $form value"; enc_missed=1
    fi
  done < <(encode_forms "${ALL[$i]}")
done
[ "$enc_missed" = 0 ] && pass "filter and scan catch all $enc_total encoded and escaped fake values"
# Encoded text that holds no secret is left alone.
printf 'GET /search?q=caf%%C3%%A9%%20menu ok\n{"msg":"a\\/b \\u0041"}\n' > "$WORK/enc-clean.log"
bash "$GUARD" scan "$WORK/enc-clean.log" > /dev/null 2>&1 \
  && pass "scan passes harmless encoded text" || bad "scan failed harmless encoded text"
[ "$(bash "$GUARD" filter "$WORK/enc-clean.log" 40 | wc -l)" = 2 ] \
  && pass "filter keeps harmless encoded lines" || bad "filter dropped harmless encoded lines"

# 3c. Uploaded artifacts. If the workflow ever uploads files, they must be
#     scanned with "scan-artifacts". Every fake value is planted in each kind
#     of artifact file: nested and hidden files, zip, tar.gz, gz, a zip
#     inside a zip, and encoded forms. Each must fail the scan on its own,
#     name the file, and never repeat the value.
make_clean_artifact() { # $1 = dir
  mkdir -p "$1/reports/.meta"
  printf 'test run passed\nGET /search?q=caf%%C3%%A9 ok\n' > "$1/reports/summary.txt"
  printf '{"tests":3,"failed":0}\n' > "$1/reports/.meta/result.json"
}
art_check() { # $1 = label, $2 = artifact dir, $3 = value, $4 = expected file name part
  local out="$WORK/art-scan.txt"
  if bash "$GUARD" scan-artifacts "$2" > "$out" 2>&1; then
    bad "artifact scan missed $1"; art_missed=1; return
  fi
  grep -qF -- "$3" "$out" && { bad "artifact scan message repeats a value ($1)"; art_missed=1; }
  grep -qF -- "$4" "$out" || { bad "artifact scan did not name $4 ($1)"; art_missed=1; }
}
art_missed=0; art_total=0
C="$WORK/art-clean"; make_clean_artifact "$C"
( cd "$C/reports" && python3 -c 'import zipfile;z=zipfile.ZipFile("bundle.zip","w");z.writestr("inner.txt","all good\n");z.close()' )
bash "$GUARD" scan-artifacts "$C" > "$WORK/art-clean.txt" 2>&1 \
  && pass "artifact scan passes a clean artifact folder (including a clean zip)" \
  || bad "artifact scan failed a clean artifact folder"
for i in "${!ALL[@]}"; do
  v="${ALL[$i]}"
  for kind in nested hidden zip targz gz zipinzip; do
    D="$WORK/art-$i-$kind"; rm -rf "$D"; make_clean_artifact "$D"
    printf 'step output\nupstream said: %s\n' "$v" > "$WORK/payload.txt"
    case "$kind" in
      nested) mkdir -p "$D/a/b"; cp "$WORK/payload.txt" "$D/a/b/deep.log"; want="deep.log" ;;
      hidden) cp "$WORK/payload.txt" "$D/reports/.meta/.env.dump"; want=".env.dump" ;;
      zip) python3 -c 'import sys,zipfile;z=zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_DEFLATED);z.write(sys.argv[2],"logs/run.log");z.close()' "$D/logs.zip" "$WORK/payload.txt"; want="logs.zip!/logs/run.log" ;;
      targz) mkdir -p "$WORK/tarsrc"; cp "$WORK/payload.txt" "$WORK/tarsrc/run.log"; tar -czf "$D/logs.tar.gz" -C "$WORK/tarsrc" run.log; want="logs.tar.gz!/run.log" ;;
      gz) gzip -c "$WORK/payload.txt" > "$D/run.log.gz"; want="run.log.gz" ;;
      zipinzip) python3 -c '
import io,sys,zipfile
inner=io.BytesIO(); z=zipfile.ZipFile(inner,"w",zipfile.ZIP_DEFLATED); z.write(sys.argv[2],"run.log"); z.close()
o=zipfile.ZipFile(sys.argv[1],"w",zipfile.ZIP_DEFLATED); o.writestr("inner.zip",inner.getvalue()); o.close()' "$D/outer.zip" "$WORK/payload.txt"; want="outer.zip!/inner.zip!/run.log" ;;
    esac
    art_total=$((art_total + 1))
    art_check "fake value #$i in a $kind artifact" "$D" "$v" "$want"
  done
  # Encoded copies inside an artifact file, and inside a zipped one.
  while IFS=$'\t' read -r form enc; do
    [ "$enc" = "$v" ] && continue
    D="$WORK/art-enc"; rm -rf "$D"; make_clean_artifact "$D"
    printf 'upstream said: %s (retrying)\n' "$enc" > "$D/reports/encoded.txt"
    art_total=$((art_total + 1))
    art_check "$form fake value #$i in an artifact" "$D" "$enc" "encoded.txt"
  done < <(encode_forms "$v" | grep -E '^(url-encoded|JSON-escaped|unicode-escaped)	')
done
[ "$art_missed" = 0 ] && pass "artifact scan catches all $art_total planted fake values"
# A single file path works too, and a missing artifact path fails loudly.
printf 'x %s\n' "$PASSWORD" > "$WORK/single.log"
bash "$GUARD" scan-artifacts "$WORK/single.log" > /dev/null 2>&1 \
  && bad "artifact scan passed a single leaking file" || pass "artifact scan checks a single file"
bash "$GUARD" scan-artifacts "$WORK/does-not-exist" > /dev/null 2>&1 \
  && bad "artifact scan passed a missing artifact path" || pass "artifact scan fails on a missing artifact path"

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
