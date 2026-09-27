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
        s = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)
        s = re.sub(r"\\x([0-9a-fA-F]{2})", lambda m: chr(int(m.group(1), 16)), s)
        s = re.sub(r"\\(.)", r"\1", s)
        s = s.replace("&quot;", "\"").replace("&amp;", "&").replace("&#x2F;", "/").replace("&#47;", "/")
        if s == prev:
            break
    return s.replace("\n", " ").replace("\r", " ")
for line in sys.stdin.buffer.read().decode("utf-8", "replace").split("\n"):
    print(dec(line))
'
}

# Values split across adjacent lines (or output chunks). Pieces are joined
# with line ends and surrounding spaces removed, up to MAX_SPLIT lines.
#   split_hits drop   : stdin = decoded lines; prints the index of every line
#                       that belongs to a smallest group of neighbours whose
#                       joined text holds a secret.
#   split_hits any F..: exit 0 if the joined text of each file, or of all
#                       files in order, holds a secret.
MAX_SPLIT=8
split_hits() {
  GUARD_KNOWN="$(known_values)" GUARD_JWT_RE="$JWT_RE" GUARD_MAX="$MAX_SPLIT" python3 - "$@" <<'PY'
import os, re, sys
known = [v for v in os.environ["GUARD_KNOWN"].split("\n") if v]
jwt = re.compile(os.environ["GUARD_JWT_RE"])
mx = int(os.environ["GUARD_MAX"])
def hit(t):
    return any(v in t for v in known) or bool(jwt.search(t))
def pieces(text):
    return [l.strip() for l in re.split(r"\r?\n|\r", text)]
mode, files = sys.argv[1], sys.argv[2:]
if mode == "drop":
    ls = pieces(sys.stdin.buffer.read().decode("utf-8", "replace"))
    drop = set()
    for i in range(len(ls)):
        for j in range(i + 1, min(i + mx, len(ls))):
            w = "".join(ls[i:j + 1])
            if hit(w):
                # Smallest group: neither end line can be left out.
                if not hit("".join(ls[i + 1:j + 1])) and not hit("".join(ls[i:j])):
                    drop.update(range(i, j + 1))
                break
    for k in sorted(drop):
        print(k)
    sys.exit(0)
texts = []
for f in files:
    try:
        texts.append(open(f, "rb").read().decode("utf-8", "replace"))
    except OSError:
        pass
joined = ["".join(pieces(t)) for t in texts]
sys.exit(0 if any(hit(j) for j in joined) or hit("".join(joined)) else 1)
PY
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
      # Encoded or escaped copies: only checked on the decoded text.
      if decode_lines < "$f" | holds_secret && ! holds_secret < "$f"; then
        echo "::error::$(basename "$f") contains an encoded or escaped backend credential"
        leaked=1
      fi
      if grep -qE "$JWT_RE" "$f"; then
        echo "::error::$(basename "$f") contains a sign-in token"
        leaked=1
      fi
    done
    exit $leaked
    ;;
  scan-artifacts)
    # Scan every file of an artifact folder (or single file), including hidden
    # files, subfolders and .zip/.tar/.tar.gz/.tgz/.gz archives, unpacked up to
    # 3 levels deep. Reports file names only, never contents.
    [ "$#" -gt 0 ] || { echo "usage: $0 scan-artifacts <dir|file>..." >&2; exit 2; }
    self="$0"
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    leaked=0
    n=0
    unpack() { # $1 = archive, $2 = dest; prints nothing on success
      python3 - "$1" "$2" <<'PY' 2>/dev/null
import gzip, os, shutil, sys, tarfile, zipfile
src, dest = sys.argv[1], sys.argv[2]
os.makedirs(dest, exist_ok=True)
def safe(name):
    p = os.path.normpath(os.path.join(dest, name))
    return p if p.startswith(os.path.abspath(dest)) or p.startswith(dest) else None
if zipfile.is_zipfile(src):
    with zipfile.ZipFile(src) as z:
        for m in z.infolist():
            p = safe(m.filename)
            if p and not m.is_dir():
                os.makedirs(os.path.dirname(p), exist_ok=True)
                with z.open(m) as i, open(p, "wb") as o: shutil.copyfileobj(i, o)
elif tarfile.is_tarfile(src):
    with tarfile.open(src) as t:
        for m in t.getmembers():
            p = safe(m.name)
            if p and m.isfile():
                os.makedirs(os.path.dirname(p), exist_ok=True)
                with t.extractfile(m) as i, open(p, "wb") as o: shutil.copyfileobj(i, o)
elif src.endswith(".gz"):
    with gzip.open(src) as i, open(os.path.join(dest, os.path.basename(src)[:-3] or "data"), "wb") as o:
        shutil.copyfileobj(i, o)
else:
    sys.exit(1)
PY
    }
    walk() { # $1 = path, $2 = label prefix, $3 = depth
      local path="$1" label="$2" depth="$3" f rel
      while IFS= read -r -d '' f; do
        rel="${label}${f#"$path"}"
        [ -f "$path" ] && rel="$label$(basename "$f")"
        n=$((n + 1))
        if ! bash "$self" scan "$f" > /dev/null 2>&1; then
          echo "::error::artifact file ${rel#/} contains a backend credential"
          leaked=1
        fi
        case "$f" in
          *.zip | *.tar | *.tar.gz | *.tgz | *.gz)
            if [ "$depth" -lt 3 ]; then
              local d="$tmp/u$n"
              if unpack "$f" "$d"; then walk "$d" "${rel#/}!" $((depth + 1)); fi
            fi
            ;;
        esac
      done < <(find "$path" -type f -print0)
    }
    for p in "$@"; do
      [ -e "$p" ] || { echo "::error::artifact path not found: $(basename "$p")"; leaked=1; continue; }
      walk "$p" "" 0
    done
    [ "$leaked" = 0 ] && echo "Scanned $n artifact file(s): no backend credentials."
    exit $leaked
    ;;
  *)
    echo "usage: $0 filter <file> [lines] | scan <file>... | scan-artifacts <dir|file>..." >&2
    exit 2
    ;;
esac
