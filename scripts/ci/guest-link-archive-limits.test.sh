#!/usr/bin/env bash
# Resource safeguards of `guest-link-log-guard.sh scan-artifacts`: deeply
# nested, oversized, zip-bomb, many-file and damaged archives must stop the scan
# quickly and FAIL (fail closed), never hang, fill the disk or pass silently.
set -uo pipefail
GUARD="$(cd "$(dirname "$0")" && pwd)/guest-link-log-guard.sh"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
fail=0
pass() { echo "ok   - $1"; }
bad() { echo "FAIL - $1"; fail=1; }

# Runs the scan with a hard 60s / 1 GiB memory cap so a broken safeguard
# shows up as a test failure instead of a stuck or crashed runner.
run() { # $1 = out file, rest = env assignments then paths
  local out="$1"; shift
  ( ulimit -v 1048576; env "$@" TMPDIR="$WORK/tmp" timeout 60 bash "$GUARD" scan-artifacts "${ARGS[@]}" ) > "$out" 2>&1
}
mkdir -p "$WORK/tmp"
expect_stop() { # $1 = label, $2 = expected reason text, $3 = dir, rest = env
  local label="$1" reason="$2" dir="$3"; shift 3
  local out="$WORK/out.txt" rc=0 t0 t1
  ARGS=("$dir")
  t0=$(date +%s); run "$out" "$@" || rc=$?; t1=$(date +%s)
  if [ "$rc" = 124 ]; then bad "$label: scan hung (timeout)"; return; fi
  if [ "$rc" = 0 ]; then bad "$label: scan passed"; cat "$out"; return; fi
  grep -qE "artifact scan stopped: .*($reason)" "$out" || { bad "$label: missing reason '$reason'"; cat "$out"; return; }
  grep -q "SECRET_CONTENT" "$out" && { bad "$label: file content printed"; return; }
  [ -z "$(ls -A "$WORK/tmp")" ] || { bad "$label: unpacked files left behind"; rm -rf "$WORK/tmp"/*; return; }
  pass "$label (stopped in $((t1 - t0))s)"
}
expect_ok() { # $1 = label, $2 = dir, rest = env
  local label="$1" dir="$2"; shift 2
  ARGS=("$dir")
  run "$WORK/out.txt" "$@" && pass "$label" || { bad "$label"; cat "$WORK/out.txt"; }
}
py() { python3 -c "$@"; }

# Nesting: an archive N levels deep.
nest() { # $1 = dir, $2 = levels
  mkdir -p "$1"; echo "harmless SECRET_CONTENT-free line" > "$1/inner.log"
  local cur="$1/inner.log" i
  for i in $(seq 1 "$2"); do
    py "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'w'); z.write(sys.argv[2],arcname=sys.argv[2].split('/')[-1]); z.close()" "$1/l$i.zip" "$cur"
    rm -f "$cur"; cur="$1/l$i.zip"
  done
}
nest "$WORK/n3" 3; expect_ok "3 archive levels are scanned" "$WORK/n3"
nest "$WORK/n4" 4; expect_stop "4 archive levels fail closed" "nested more than 3" "$WORK/n4"
nest "$WORK/n30" 30; expect_stop "30 archive levels fail closed" "nested more than 3" "$WORK/n30"
nest "$WORK/n2" 2; expect_stop "custom depth limit is honoured" "nested more than 1" "$WORK/n2" ARTIFACT_MAX_DEPTH=1

# Zip bomb: 400 MiB of zeros compresses to ~400 KiB.
mkdir -p "$WORK/bomb"
py "
import zipfile,sys
with zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED) as z:
  with z.open('zeros.log','w',force_zip64=True) as f:
    b=bytes(1<<20)
    for _ in range(400): f.write(b)
" "$WORK/bomb/bomb.zip"
expect_stop "zip bomb stops on its declared file size" "larger than" "$WORK/bomb"
expect_stop "zip bomb stops on the size ratio" "times its size" "$WORK/bomb" ARTIFACT_MAX_FILE_BYTES=1000000000

# gzip and tar.gz bombs (sizes not declared up front for .gz).
mkdir -p "$WORK/gzb" "$WORK/tgzb"
py "
import gzip,sys
with gzip.open(sys.argv[1],'wb') as f:
  b=bytes(1<<20)
  for _ in range(300): f.write(b)
" "$WORK/gzb/big.log.gz"
expect_stop "gzip bomb fails closed" "times its size|larger than" "$WORK/gzb"
py "
import tarfile,sys,io
class Z(io.RawIOBase):
  def __init__(s,n): s.n=n
  def readinto(s,b):
    k=min(len(b),s.n); b[:k]=bytes(k); s.n-=k; return k
with tarfile.open(sys.argv[1],'w:gz') as t:
  i=tarfile.TarInfo('zeros.log'); i.size=300<<20; t.addfile(i,Z(i.size))
" "$WORK/tgzb/big.tar.gz"
expect_stop "tar.gz bomb fails closed" "larger than" "$WORK/tgzb"

# Total unpacked bytes across many honest archives.
mkdir -p "$WORK/total"
for i in 1 2 3; do head -c 3000000 /dev/urandom | base64 > "$WORK/f$i.log"; gzip -c "$WORK/f$i.log" > "$WORK/total/p$i.log.gz"; done
expect_stop "total unpacked size limit" "bytes unpacked in total" "$WORK/total" ARTIFACT_MAX_TOTAL_BYTES=8000000

# Many files: one archive with 20k tiny entries, and a plain folder.
mkdir -p "$WORK/many"
py "
import zipfile,sys
with zipfile.ZipFile(sys.argv[1],'w') as z:
  for i in range(20000): z.writestr(f'f{i}.log','x')
" "$WORK/many/many.zip"
expect_stop "archive with too many files" "more than 5000 files" "$WORK/many"
mkdir -p "$WORK/manydir"; for i in $(seq 1 30); do : > "$WORK/manydir/$i.log"; done
expect_stop "folder with too many files" "more than 20 files" "$WORK/manydir" ARTIFACT_MAX_FILES=20

# Oversized plain file in the artifact folder.
mkdir -p "$WORK/huge"; head -c 2000000 /dev/zero > "$WORK/huge/big.log"
expect_stop "oversized plain file" "larger than 1000000 bytes" "$WORK/huge" ARTIFACT_MAX_FILE_BYTES=1000000

# Damaged archive: a truncated gzip.
gzip -c "$WORK/f1.log" | head -c 1000 > "$WORK/broken2.log.gz"; mkdir -p "$WORK/broken2"; mv "$WORK/broken2.log.gz" "$WORK/broken2/"
expect_stop "truncated gzip fails closed" "damaged" "$WORK/broken2"

# Time limit.
mkdir -p "$WORK/slow"; for i in 1 2 3; do echo x > "$WORK/slow/$i.log"; done
expect_stop "time limit" "longer than" "$WORK/slow" ARTIFACT_MAX_SECONDS=-1

# A leak found before a limit is hit is still reported by file name.
mkdir -p "$WORK/leakfirst"; echo "SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnopqrstu" > "$WORK/leakfirst/a.log"
ARGS=("$WORK/leakfirst"); run "$WORK/out.txt" || true
grep -q "a.log contains a backend credential" "$WORK/out.txt" && pass "leaks still reported with safeguards on" || { bad "leak not reported"; cat "$WORK/out.txt"; }

[ "$fail" = 0 ] && echo "All archive limit checks passed." || echo "Archive limit checks FAILED."
exit $fail
