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
    # Diagnostics are sanitized: they name the limit, the measured value, the
    # threshold, the nesting depth and a cleaned file name. They never carry
    # file contents, and a file name that itself looks like a credential is
    # replaced by "[name hidden]". Optional machine-readable copy:
    #   ARTIFACT_SCAN_REPORT=<path>  writes one JSON object (key=value only).
    report="${ARTIFACT_SCAN_REPORT:-}"
    r_status=ok r_limit="" r_observed="" r_threshold="" r_depth="" r_file="" r_detail=""
    safe_name() { # $1 = raw name -> printable, <=120 chars, hidden if it holds a credential
      local raw="$1" clean chk="$tmp/.name"
      clean=$(printf '%s' "$raw" | LC_ALL=C tr -cd '[:alnum:]._/!+@=,:-' | cut -c1-120)
      [ ${#raw} -gt 120 ] && clean="$clean..."
      printf '%s\n' "$raw" > "$chk"
      if ! bash "$self" scan "$chk" > /dev/null 2>&1 \
        || printf '%s' "$raw" | grep -qiE 'eyJ[a-z0-9_-]{8,}|(secret|password|passwd|token|apikey|api_key|service_role)[^/]*[=:]'; then
        clean="[name hidden]"
      fi
      rm -f "$chk"
      printf '%s' "${clean:-[unnamed]}"
    }
    limit() { # $1 = code, $2 = observed, $3 = threshold, $4 = raw file name, $5 = depth, $6 = detail
      local code="$1" obs="$2" thr="$3" file depth="${5:-0}" detail="${6:-}" reason
      file=$(safe_name "${4:-}")
      case "$code" in
        depth) reason="$file is nested more than $thr archive levels deep" ;;
        files) reason="more than $thr files to scan" ;;
        archive_files) reason="$file holds more than $thr files" ;;
        file_bytes) reason="$file is larger than $thr bytes" ;;
        total_bytes) reason="more than $thr bytes unpacked in total" ;;
        ratio) reason="$file unpacks to over $thr times its size (possible zip bomb)" ;;
        seconds) reason="took longer than $thr seconds" ;;
        damaged) reason="$file is damaged and cannot be fully scanned" ;;
        encrypted) reason="$file is password-protected and cannot be scanned" ;;
        link) reason="$file is a link, which is never followed or unpacked" ;;
        special) reason="$file is not a regular file (device, pipe or socket)" ;;
        unsafe_path) reason="$file points outside the scan folder" ;;
        *) code=unknown; reason="$file could not be scanned" ;;
      esac
      detail=$(printf '%s' "$detail" | LC_ALL=C tr -cd '[:alnum:]_' | cut -c1-40)
      echo "::error::artifact scan stopped: $reason [limit=$code observed=${obs:--} threshold=${thr:--} depth=$depth file=$file${detail:+ detail=$detail}]"
      r_status=limit r_limit=$code r_observed=$obs r_threshold=$thr r_depth=$depth r_file=$file r_detail=$detail
      leaked=1
      stop=1
    }
    unpack() { # $1 = archive, $2 = dest; exit 0 ok, 3 limit hit or damaged (code, observed, threshold, member, detail separated by \x1f on stdout)
      python3 - "$1" "$2" <<'PY' 2>/dev/null
import gzip, os, stat, sys, tarfile, zipfile
src, dest = sys.argv[1], sys.argv[2]
MAX_FILE = int(os.environ["MAX_FILE_BYTES"]); MAX_TOTAL = int(os.environ["MAX_TOTAL_BYTES"])
MAX_RATIO = int(os.environ["MAX_RATIO"]); MAX_FILES = int(os.environ["MAX_FILES"])
budget_path = os.environ["BUDGET"]
with open(budget_path) as b: total = int(b.read().strip() or 0)
packed = max(os.path.getsize(src), 1)
written = 0; members = 0
class Limit(Exception):
    def __init__(self, code, observed, threshold, member=""):
        self.row = (code, str(observed), str(threshold), member)
def save():
    with open(budget_path, "w") as b: b.write(str(total))
ROOT = os.path.realpath(dest if os.path.isdir(dest) else (os.makedirs(dest, exist_ok=True) or dest))
def inside(p):
    return p == ROOT or p.startswith(ROOT + os.sep)
def safe(name):
    # Absolute names, drive letters, ".." hops and NUL bytes are refused
    # (fail closed) instead of being silently skipped.
    if not name or "\x00" in name or name.startswith(("/", "\\")) or (len(name) > 1 and name[1] == ":"):
        raise Limit("unsafe_path", "-", "-", name)
    p = os.path.abspath(os.path.join(ROOT, name))
    if not inside(p) or ".." in name.replace("\\", "/").split("/"):
        raise Limit("unsafe_path", "-", "-", name)
    return p
def copy(i, p, name):
    global total, written
    os.makedirs(os.path.dirname(p), exist_ok=True)
    # Re-check after creating folders: the real parent must still be inside
    # the scan folder, and the file is opened without following links.
    if not inside(os.path.realpath(os.path.dirname(p))):
        raise Limit("unsafe_path", "-", "-", name)
    size = 0
    fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as o:
        while True:
            chunk = i.read(1 << 16)
            if not chunk: break
            size += len(chunk); written += len(chunk); total += len(chunk)
            if size > MAX_FILE: raise Limit("file_bytes", f">{MAX_FILE}", MAX_FILE, name)
            if total > MAX_TOTAL: raise Limit("total_bytes", total, MAX_TOTAL, name)
            if written > packed * MAX_RATIO and written > (1 << 20):
                raise Limit("ratio", written // packed, MAX_RATIO, "")
            o.write(chunk)
def member():
    global members
    members += 1
    if members > MAX_FILES: raise Limit("archive_files", members, MAX_FILES, "")
os.makedirs(dest, exist_ok=True)
try:
    if zipfile.is_zipfile(src):
        with zipfile.ZipFile(src) as z:
            infos = z.infolist()
            if len(infos) > MAX_FILES: raise Limit("archive_files", len(infos), MAX_FILES, "")
            for m in infos:
                mode = m.external_attr >> 16
                if m.flag_bits & 0x1:
                    raise Limit("encrypted", "-", "-", m.filename)
                if stat.S_ISLNK(mode):
                    raise Limit("link", "-", "-", m.filename)
                if mode and not (stat.S_ISREG(mode) or stat.S_ISDIR(mode)):
                    raise Limit("special", "-", "-", m.filename)
                p = safe(m.filename)
                if not m.is_dir():
                    member()
                    if m.file_size > MAX_FILE: raise Limit("file_bytes", m.file_size, MAX_FILE, m.filename)
                    with z.open(m) as i: copy(i, p, m.filename)
    elif src.endswith(".gz") and not src.endswith(".tar.gz"):
        member()
        with gzip.open(src) as i: copy(i, os.path.join(dest, os.path.basename(src)[:-3] or "data"), "")
    elif tarfile.is_tarfile(src):
        with tarfile.open(src) as t:
            for m in t:  # streaming: never loads the whole member list
                if m.issym() or m.islnk():
                    raise Limit("link", "-", "-", m.name)
                if not (m.isfile() or m.isdir()):
                    raise Limit("special", "-", "-", m.name)
                p = safe(m.name)
                if m.isfile():
                    member()
                    if m.size > MAX_FILE: raise Limit("file_bytes", m.size, MAX_FILE, m.name)
                    with t.extractfile(m) as i: copy(i, p, m.name)
        if src.endswith((".tar.gz", ".tgz")):
            # tarfile stops at the end-of-archive marker and never reads the
            # gzip checksum, so corrupted data could pass unnoticed: read the
            # whole stream once to force the checksum and length checks.
            with gzip.open(src) as g:
                while g.read(1 << 16): pass
    else:
        # The name says archive but neither zip nor tar can read it (for
        # example a zip cut short before its index): treat as damaged.
        raise ValueError("unreadable archive")
except Limit as e:
    save(); print("\x1f".join(x.replace("\x1f", " ").replace("\n", " ") for x in e.row) + "\x1f"); sys.exit(3)
except Exception as e:
    # Any read error (bad checksum, cut-off data, unsupported compression,
    # zlib errors) means the archive cannot be fully scanned: fail closed.
    # Only the error TYPE is reported, never its message (it can quote data).
    save(); print(f"damaged\x1f-\x1f-\x1f\x1f{type(e).__name__}"); sys.exit(3)
save()
PY
    }
    walk() { # $1 = path, $2 = label prefix, $3 = depth
      local path="$1" label="$2" depth="$3" f rel rc msg code obs thr mem det size
      # Links and special files in the folder itself are never followed and
      # would otherwise be skipped unscanned: fail closed.
      local odd
      odd=$(find "$path" -mindepth 0 \( -type l -o \( ! -type f ! -type d \) \) -print -quit 2>/dev/null)
      if [ -n "$odd" ]; then
        rel="${odd#"$path"}"; rel="$label${rel#/}"; [ "$odd" = "$path" ] && rel="$label$(basename "$odd")"
        if [ -L "$odd" ]; then limit link - - "$rel" "$depth"; else limit special - - "$rel" "$depth"; fi
        return
      fi
      while IFS= read -r -d '' f; do
        [ "$stop" = 1 ] && return
        rel="${f#"$path"}"
        rel="$label${rel#/}"
        [ -f "$path" ] && rel="$label$(basename "$f")"
        n=$((n + 1))
        if [ "$n" -gt "$MAX_FILES" ]; then limit files "$n" "$MAX_FILES" "$rel" "$depth"; return; fi
        if [ "$(date +%s)" -gt "$deadline" ]; then
          limit seconds "$(($(date +%s) - deadline + MAX_SECONDS))" "$MAX_SECONDS" "$rel" "$depth"; return
        fi
        size=$(stat -c %s "$f")
        if [ "$size" -gt "$MAX_FILE_BYTES" ]; then limit file_bytes "$size" "$MAX_FILE_BYTES" "$rel" "$depth"; return; fi
        if ! bash "$self" scan "$f" > /dev/null 2>&1; then
          echo "::error::artifact file $(safe_name "$rel") contains a backend credential"
          r_status=leak
          leaked=1
        fi
        case "$f" in
          *.zip | *.tar | *.tar.gz | *.tgz | *.gz)
            local d="$tmp/u$n"
            rc=0
            msg=$(unpack "$f" "$d") || rc=$?
            if [ "$rc" = 3 ]; then
              IFS=$'\x1f' read -r code obs thr mem det <<< "$msg"
              limit "$code" "$obs" "$thr" "$rel${mem:+!$mem}" "$depth" "$det"; rm -rf "$d"; return
            fi
            # Any other failure (crash, killed for memory) is never a pass.
            if [ "$rc" != 0 ]; then limit damaged - - "$rel" "$depth" "exit_$rc"; rm -rf "$d"; return; fi
            if [ "$depth" -ge "$MAX_DEPTH" ]; then
              limit depth "$((depth + 1))" "$MAX_DEPTH" "$rel" "$depth"; rm -rf "$d"; return
            fi
            walk "$d" "$rel!" $((depth + 1))
            rm -rf "$d" # free disk as soon as a level is scanned
            ;;
        esac
      done < <(find "$path" -type f -print0)
    }
    for p in "$@"; do
      [ "$stop" = 1 ] && break
      [ -e "$p" ] || { echo "::error::artifact path not found: $(safe_name "$(basename "$p")")"; leaked=1; r_status=missing; continue; }
      walk "$p" "" 0
    done
    if [ -n "$report" ]; then
      python3 -c 'import json,sys
k=["status","limit","observed","threshold","depth","file","detail","files_scanned","bytes_unpacked"]
print(json.dumps(dict(zip(k,sys.argv[1:]))))' "$r_status" "$r_limit" "$r_observed" "$r_threshold" "$r_depth" "$r_file" "$r_detail" "$n" "$(cat "$BUDGET")" > "$report"
    fi
    [ "$leaked" = 0 ] && echo "Scanned $n artifact file(s): no backend credentials."
    exit $leaked
    ;;
  *)
    echo "usage: $0 filter <file> [lines] | scan <file>... | scan-artifacts <dir|file>..." >&2
    exit 2
    ;;
esac
