#!/usr/bin/env bash
# Log guard for the "Guest link test backend" workflow.
#
# Every place that workflow prints backend output goes through this script,
# so one tested filter decides what may reach the GitHub log.
#
#   guest-link-log-guard.sh filter <file> [lines]
#       Print the last N lines (default 40) of <file> with every line that
#       mentions a key, secret, password, token or database address dropped,
#       and any JWT-looking or known secret value replaced by ***.
#   guest-link-log-guard.sh scan <file>...
#       Exit 1 if any file contains a known secret value or a JWT.
#
# Both commands also look through URL encoding (including double and
# every-byte encoding) and escaping (JSON \/ \" \uXXXX, \xHH, backslash
# escapes): each line is decoded first, and a line whose decoded form holds
# a secret is dropped (filter) or reported (scan).
#
# Known secret values are read from the environment: SERVICE_ROLE_KEY,
# JWT_SECRET, ANON_KEY, DB_URL, GUEST_LINK_TOKEN, plus the fixed test
# password. Values are never printed.
set -u

FIXED_PASSWORD="ci-guest-portal-password"
JWT_RE='eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.?[A-Za-z0-9_-]*'
DROP_RE='key|secret|password|token|postgres(ql)?://|bearer'

known_values() {
  for v in "${SERVICE_ROLE_KEY:-}" "${JWT_SECRET:-}" "${ANON_KEY:-}" \
    "${DB_URL:-}" "${GUEST_LINK_TOKEN:-}" "$FIXED_PASSWORD"; do
    [ -n "$v" ] && printf '%s\n' "$v"
  done
  # The database password on its own, taken from DB_URL.
  if [ -n "${DB_URL:-}" ]; then
    local pw
    pw=$(printf '%s' "$DB_URL" | sed -nE 's#^[a-z]+://[^:/@]+:([^@]+)@.*#\1#p')
    [ -n "$pw" ] && printf '%s\n' "$pw"
  fi
  return 0
}

redact_known() {
  # Replace each known value literally (no regex interpretation).
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    while IFS= read -r v; do
      [ -n "$v" ] && line="${line//"$v"/***}"
    done < <(known_values)
    printf '%s\n' "$line"
  done
}

# Print each input line decoded, one output line per input line.
decode_lines() {
  python3 -c '
import re, sys
from urllib.parse import unquote
def dec(s):
    for _ in range(3):
        prev = s
        s = unquote(s)
        s = re.sub(r"\\\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)
        s = re.sub(r"\\\\x([0-9a-fA-F]{2})", lambda m: chr(int(m.group(1), 16)), s)
        s = re.sub(r"\\\\(.)", r"\\1", s)
        s = s.replace("&quot;", "\"").replace("&amp;", "&").replace("&#x2F;", "/").replace("&#47;", "/")
        if s == prev:
            break
    return s.replace("\n", " ").replace("\r", " ")
for line in sys.stdin.buffer.read().decode("utf-8", "replace").split("\n"):
    print(dec(line))
'
}

# True if the text on stdin holds a known value or a JWT.
holds_secret() {
  local text
  text=$(cat)
  printf '%s' "$text" | grep -qE "$JWT_RE" && return 0
  while IFS= read -r v; do
    [ -n "$v" ] && [[ "$text" == *"$v"* ]] && return 0
  done < <(known_values)
  return 1
}

cmd="${1:-}"
shift || true

case "$cmd" in
  filter)
    file="${1:-}"
    lines="${2:-40}"
    [ -f "$file" ] || exit 0
    mapfile -t orig < <(tail -n "$lines" "$file")
    mapfile -t decoded < <(printf '%s\n' "${orig[@]}" | decode_lines)
    for i in "${!orig[@]}"; do
      d="${decoded[$i]:-}"
      printf '%s' "$d" | grep -qiE "$DROP_RE" && continue
      printf '%s' "$d" | holds_secret && continue
      printf '%s\n' "${orig[$i]}"
    done | sed -E "s/${JWT_RE}/***/g" | redact_known
    exit 0
    ;;
  scan)
    leaked=0
    for f in "$@"; do
      [ -f "$f" ] || continue
      while IFS= read -r v; do
        if grep -qF -- "$v" "$f"; then
          echo "::error::$(basename "$f") contains a backend credential"
          leaked=1
          break
        fi
      done < <(known_values)
      if [ "$leaked" = 0 ] || true; then
        if decode_lines < "$f" | holds_secret; then
          grep -qE "$JWT_RE" "$f" || { while IFS= read -r v; do grep -qF -- "$v" "$f" && break; done < <(known_values); } \
            || { echo "::error::$(basename "$f") contains an encoded or escaped backend credential"; leaked=1; }
        fi
      fi
      if grep -qE "$JWT_RE" "$f"; then
        echo "::error::$(basename "$f") contains a sign-in token"
        leaked=1
      fi
    done
    exit $leaked
    ;;
  *)
    echo "usage: $0 filter <file> [lines] | scan <file>..." >&2
    exit 2
    ;;
esac
