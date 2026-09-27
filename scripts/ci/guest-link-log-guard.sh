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
  # The script goes in -c so the lines to check can come in on stdin.
  GUARD_KNOWN="$(known_values)" GUARD_JWT_RE="$JWT_RE" GUARD_MAX="$MAX_SPLIT" \
    python3 -c "$SPLIT_PY" "$@"
}
SPLIT_PY=$(cat <<'PY'
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
)

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
    # Lines that only hold a secret together with their neighbours.
    declare -A split_drop=()
    while IFS= read -r k; do [ -n "$k" ] && split_drop[$k]=1; done < <(
      printf '%s\n' "${orig[@]}" | split_hits drop
      printf '%s\n' "${decoded[@]}" | split_hits drop
    )
    for i in "${!orig[@]}"; do
      [ -n "${split_drop[$i]:-}" ] && continue
      d="${decoded[$i]:-}"
      printf '%s' "$d" | grep -qiE "$DROP_RE" && continue
      printf '%s' "$d" | holds_secret && continue
      printf '%s\n' "${orig[$i]}"
    done | sed -E "s/${JWT_RE}/***/g" | redact_known
    exit 0
    ;;
  scan)
    leaked=0
    present=()
    for f in "$@"; do
      [ -f "$f" ] || continue
      present+=("$f")
      file_leaked=0
      while IFS= read -r v; do
        if grep -qF -- "$v" "$f"; then
          echo "::error::$(basename "$f") contains a backend credential"
          file_leaked=1
          break
        fi
      done < <(known_values)
      # Encoded or escaped copies: only checked on the decoded text.
      if decode_lines < "$f" | holds_secret && ! holds_secret < "$f"; then
        echo "::error::$(basename "$f") contains an encoded or escaped backend credential"
        file_leaked=1
      fi
      if grep -qE "$JWT_RE" "$f"; then
        echo "::error::$(basename "$f") contains a sign-in token"
        file_leaked=1
      fi
      # Split across adjacent lines (raw or decoded).
      if [ "$file_leaked" = 0 ]; then
        dec=$(mktemp)
        decode_lines < "$f" > "$dec"
        if split_hits any "$f" || split_hits any "$dec"; then
          echo "::error::$(basename "$f") contains a backend credential split across lines"
          file_leaked=1
        fi
        rm -f "$dec"
      fi
      [ "$file_leaked" = 1 ] && leaked=1
    done
    # Split across output chunks: the files joined in the order given.
    if [ "$leaked" = 0 ] && [ "${#present[@]}" -gt 1 ] && split_hits any "${present[@]}"; then
      names=$(for f in "${present[@]}"; do basename "$f"; done | paste -sd, -)
      echo "::error::a backend credential is split across output chunks ($names)"
      leaked=1
    fi
    exit $leaked
    ;;
  scan-artifacts)
    # Scan every file of an artifact folder (or single file), including hidden
    # files, subfolders and .zip/.tar/.tar.gz/.tgz/.gz archives, unpacked up to
    # ARTIFACT_MAX_DEPTH levels deep. Reports file names only, never contents.
    #
    # Resource safeguards (fail closed: anything we cannot fully scan fails):
    #   ARTIFACT_MAX_DEPTH        archive nesting levels (default 3)
    #   ARTIFACT_MAX_FILES        files scanned in total (default 5000)
    #   ARTIFACT_MAX_FILE_BYTES   size of one file, packed or unpacked (default 50 MiB)
    #   ARTIFACT_MAX_TOTAL_BYTES  bytes unpacked in total (default 200 MiB)
    #   ARTIFACT_MAX_RATIO        unpacked:packed size ratio per archive (default 200)
    #   ARTIFACT_MAX_SECONDS      wall-clock time for the whole scan (default 300)
    [ "$#" -gt 0 ] || { echo "usage: $0 scan-artifacts <dir|file>..." >&2; exit 2; }
    self="$0"
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    export MAX_DEPTH="${ARTIFACT_MAX_DEPTH:-3}" MAX_FILES="${ARTIFACT_MAX_FILES:-5000}"
    export MAX_FILE_BYTES="${ARTIFACT_MAX_FILE_BYTES:-52428800}"
    export MAX_TOTAL_BYTES="${ARTIFACT_MAX_TOTAL_BYTES:-209715200}"
    export MAX_RATIO="${ARTIFACT_MAX_RATIO:-200}" MAX_SECONDS="${ARTIFACT_MAX_SECONDS:-300}"
    export BUDGET="$tmp/.budget"
    echo 0 > "$BUDGET"
    deadline=$(($(date +%s) + MAX_SECONDS))
    leaked=0
    n=0
    stop=0
    limit() { # $1 = reason; fail closed and stop scanning
      echo "::error::artifact scan stopped: $1"
      leaked=1
      stop=1
    }
    unpack() { # $1 = archive, $2 = dest; exit 0 ok, 1 not an archive, 3 limit hit (reason on stdout)
      python3 - "$1" "$2" <<'PY' 2>/dev/null
import gzip, os, sys, tarfile, zipfile
src, dest = sys.argv[1], sys.argv[2]
MAX_FILE = int(os.environ["MAX_FILE_BYTES"]); MAX_TOTAL = int(os.environ["MAX_TOTAL_BYTES"])
MAX_RATIO = int(os.environ["MAX_RATIO"]); MAX_FILES = int(os.environ["MAX_FILES"])
budget_path = os.environ["BUDGET"]
with open(budget_path) as b: total = int(b.read().strip() or 0)
packed = max(os.path.getsize(src), 1)
written = 0; members = 0
class Limit(Exception): pass
def save():
    with open(budget_path, "w") as b: b.write(str(total))
def safe(name):
    root = os.path.abspath(dest)
    p = os.path.abspath(os.path.join(root, name))
    return p if p.startswith(root + os.sep) else None
def copy(i, p, name):
    global total, written
    os.makedirs(os.path.dirname(p), exist_ok=True)
    size = 0
    with open(p, "wb") as o:
        while True:
            chunk = i.read(1 << 16)
            if not chunk: break
            size += len(chunk); written += len(chunk); total += len(chunk)
            if size > MAX_FILE: raise Limit(f"a file inside {os.path.basename(src)} is larger than {MAX_FILE} bytes")
            if total > MAX_TOTAL: raise Limit(f"more than {MAX_TOTAL} bytes unpacked in total")
            if written > packed * MAX_RATIO and written > (1 << 20):
                raise Limit(f"{os.path.basename(src)} unpacks to over {MAX_RATIO} times its size (possible zip bomb)")
            o.write(chunk)
def member():
    global members
    members += 1
    if members > MAX_FILES: raise Limit(f"{os.path.basename(src)} holds more than {MAX_FILES} files")
os.makedirs(dest, exist_ok=True)
try:
    if zipfile.is_zipfile(src):
        with zipfile.ZipFile(src) as z:
            infos = z.infolist()
            if len(infos) > MAX_FILES: raise Limit(f"{os.path.basename(src)} holds more than {MAX_FILES} files")
            for m in infos:
                p = safe(m.filename)
                if p and not m.is_dir():
                    member()
                    if m.file_size > MAX_FILE: raise Limit(f"a file inside {os.path.basename(src)} is larger than {MAX_FILE} bytes")
                    with z.open(m) as i: copy(i, p, m.filename)
    elif tarfile.is_tarfile(src):
        with tarfile.open(src) as t:
            for m in t:  # streaming: never loads the whole member list
                p = safe(m.name)
                if p and m.isfile():
                    member()
                    if m.size > MAX_FILE: raise Limit(f"a file inside {os.path.basename(src)} is larger than {MAX_FILE} bytes")
                    with t.extractfile(m) as i: copy(i, p, m.name)
    elif src.endswith(".gz"):
        member()
        with gzip.open(src) as i: copy(i, os.path.join(dest, os.path.basename(src)[:-3] or "data"), "data")
    else:
        sys.exit(1)
except Limit as e:
    save(); print(e); sys.exit(3)
except (zipfile.BadZipFile, tarfile.TarError, OSError, EOFError, gzip.BadGzipFile) as e:
    save(); print(f"{os.path.basename(src)} is damaged and cannot be fully scanned"); sys.exit(3)
save()
PY
    }
    walk() { # $1 = path, $2 = label prefix, $3 = depth
      local path="$1" label="$2" depth="$3" f rel rc msg
      while IFS= read -r -d '' f; do
        [ "$stop" = 1 ] && return
        rel="${label}${f#"$path"}"
        [ -f "$path" ] && rel="$label$(basename "$f")"
        n=$((n + 1))
        if [ "$n" -gt "$MAX_FILES" ]; then limit "more than $MAX_FILES files to scan"; return; fi
        if [ "$(date +%s)" -gt "$deadline" ]; then limit "took longer than $MAX_SECONDS seconds"; return; fi
        if [ "$(stat -c %s "$f")" -gt "$MAX_FILE_BYTES" ]; then
          limit "${rel#/} is larger than $MAX_FILE_BYTES bytes"; return
        fi
        if ! bash "$self" scan "$f" > /dev/null 2>&1; then
          echo "::error::artifact file ${rel#/} contains a backend credential"
          leaked=1
        fi
        case "$f" in
          *.zip | *.tar | *.tar.gz | *.tgz | *.gz)
            local d="$tmp/u$n"
            rc=0
            msg=$(unpack "$f" "$d") || rc=$?
            if [ "$rc" = 3 ]; then limit "$msg"; rm -rf "$d"; return; fi
            if [ "$rc" = 0 ]; then
              if [ "$depth" -ge "$MAX_DEPTH" ]; then
                limit "${rel#/} is nested more than $MAX_DEPTH archive levels deep"; rm -rf "$d"; return
              fi
              walk "$d" "${rel#/}!" $((depth + 1))
              rm -rf "$d" # free disk as soon as a level is scanned
            fi
            ;;
        esac
      done < <(find "$path" -type f -print0)
    }
    for p in "$@"; do
      [ "$stop" = 1 ] && break
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
