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

cmd="${1:-}"
shift || true

case "$cmd" in
  filter)
    file="${1:-}"
    lines="${2:-40}"
    [ -f "$file" ] || exit 0
    tail -n "$lines" "$file" \
      | grep -viE "$DROP_RE" \
      | sed -E "s/${JWT_RE}/***/g" \
      | redact_known
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
