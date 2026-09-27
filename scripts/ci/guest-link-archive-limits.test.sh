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

# Corrupted and truncated archives: every one must FAIL with "damaged", even
# when the readable part looks clean, and never print contents.
CL="$WORK/clean-src"; mkdir -p "$CL"; for i in $(seq 1 40); do head -c 4000 /dev/urandom | base64 > "$CL/f$i.log"; done
(cd "$CL" && python3 -c "
import zipfile,glob
with zipfile.ZipFile('../good.zip','w',zipfile.ZIP_DEFLATED) as z:
  [z.write(f) for f in sorted(glob.glob('*.log'))]" && tar -cf ../good.tar *.log && tar -czf ../good.tar.gz *.log && cat *.log | gzip -c > ../good.log.gz)
dmg() { # $1 = label, $2 = file name inside the artifact, then python to build it from $SRC into $DST
  local d="$WORK/dmg-$RANDOM$RANDOM"; mkdir -p "$d"
  SRC="$3" DST="$d/$2" python3 -c "$4"
  expect_stop "$1" "damaged" "$d"
}
TRUNC='import os; b=open(os.environ["SRC"],"rb").read(); open(os.environ["DST"],"wb").write(b[:len(b)//2])'
FLIP='import os; b=bytearray(open(os.environ["SRC"],"rb").read()); n=len(b)//2
for i in range(n, n+64): b[i]^=0xFF
open(os.environ["DST"],"wb").write(b)'
dmg "truncated zip"                upload.zip     "$WORK/good.zip"    "$TRUNC"
dmg "zip with corrupted data"      upload.zip     "$WORK/good.zip"    "$FLIP"
dmg "truncated tar"                upload.tar     "$WORK/good.tar"    "$TRUNC"
dmg "truncated tar.gz"             upload.tar.gz  "$WORK/good.tar.gz" "$TRUNC"
dmg "tar.gz with corrupted data"   upload.tar.gz  "$WORK/good.tar.gz" "$FLIP"
dmg "truncated gzip"               upload.log.gz  "$WORK/good.log.gz" "$TRUNC"
dmg "gzip with corrupted data"     upload.log.gz  "$WORK/good.log.gz" "$FLIP"
dmg "gzip with a bad checksum"     upload.log.gz  "$WORK/good.log.gz" 'import os; b=bytearray(open(os.environ["SRC"],"rb").read()); b[-8]^=0xFF; open(os.environ["DST"],"wb").write(b)'
dmg "zip with a bad file checksum" upload.zip     "$WORK/good.zip"    'import os,zipfile,struct
b=bytearray(open(os.environ["SRC"],"rb").read()); c=b.rfind(b"PK\x05\x06")
cd=struct.unpack("<I",b[c+16:c+20])[0]; b[cd+16]^=0xFF; open(os.environ["DST"],"wb").write(b)'
dmg "random bytes named .zip"      upload.zip     /dev/null           'import os; open(os.environ["DST"],"wb").write(os.urandom(5000))'
dmg "empty file named .tar.gz"     upload.tar.gz  /dev/null           'import os; open(os.environ["DST"],"wb").write(b"")'
dmg "zip header only"              upload.zip     /dev/null           'import os; open(os.environ["DST"],"wb").write(b"PK\x03\x04"+os.urandom(40))'
# Damaged archive nested inside a valid one.
d="$WORK/dmg-nested"; mkdir -p "$d"
SRC="$WORK/good.zip" python3 -c 'import os,zipfile; b=open(os.environ["SRC"],"rb").read()
with zipfile.ZipFile("'"$d"'/outer.zip","w") as z: z.writestr("inner/cut.zip", b[:len(b)//2])'
expect_stop "damaged zip inside a valid zip" "damaged" "$d"
# A secret in the readable part of a truncated archive is still reported.
d="$WORK/dmg-leak"; mkdir -p "$d"
python3 -c 'import zipfile,io,sys
buf=io.BytesIO()
with zipfile.ZipFile(buf,"w") as z:
  z.writestr("a.log","SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnopqrstu\n")
  z.writestr("b.log","x"*20000)
b=buf.getvalue(); open(sys.argv[1],"wb").write(b[:len(b)-200])' "$d/cut.zip"
ARGS=("$d"); run "$WORK/out.txt" && { bad "truncated zip with a secret passed"; } || {
  grep -q "damaged" "$WORK/out.txt" && ! grep -q "abcdefghijklmnop" "$WORK/out.txt" \
    && pass "truncated zip with a secret fails without printing it" || { bad "truncated zip with a secret"; cat "$WORK/out.txt"; }; }
# The same clean archives, undamaged, pass.
d="$WORK/good-all"; mkdir -p "$d"; cp "$WORK"/good.zip "$WORK"/good.tar "$WORK"/good.tar.gz "$WORK"/good.log.gz "$d"/
expect_ok "undamaged copies of the same archives pass" "$d"

# Sanitized diagnostics: every stop names the limit, measured value and
# threshold in a fixed [limit=... observed=... threshold=... depth=... file=...]
# form, never file contents, and hides file names that look like credentials.
FAKE_JWT="eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.zzzzSECRETzzzzzzzzzz"
diag() { # $1 = label, $2 = dir, $3 = regex the diagnostic line must match, rest = env
  local label="$1" dir="$2" want="$3"; shift 3
  local out="$WORK/diag.txt" rep="$WORK/diag.json"
  rm -f "$rep"; ARGS=("$dir")
  run "$out" ARTIFACT_SCAN_REPORT="$rep" "$@" && { bad "$label: scan passed"; return; }
  local line; line=$(grep -m1 'artifact scan stopped' "$out")
  [[ "$line" =~ \[limit=[a-z_]+\ observed=[^\ ]+\ threshold=[^\ ]+\ depth=[0-9]+\ file=[^]]* ]] \
    || { bad "$label: diagnostic not in the fixed form: $line"; return; }
  echo "$line" | grep -qE "$want" || { bad "$label: expected /$want/ in: $line"; return; }
  grep -qE 'SECRET_CONTENT|zzzzSECRET|PLANTED_BODY' "$out" && { bad "$label: contents printed"; return; }
  python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert d["status"]=="limit" and d["limit"], d' "$rep" 2>/dev/null \
    || { bad "$label: JSON report missing or wrong"; return; }
  grep -qE 'SECRET_CONTENT|zzzzSECRET|PLANTED_BODY' "$rep" && { bad "$label: contents in JSON report"; return; }
  pass "$label"
}
diag "diagnostic: depth"          "$WORK/n4"       'limit=depth observed=4 threshold=3 depth=3 file=l4.zip!l3.zip!l2.zip!l1.zip'
diag "diagnostic: declared size"  "$WORK/bomb"     'limit=file_bytes observed=419430400 threshold=52428800 depth=0 file=bomb.zip!zeros.log'
diag "diagnostic: ratio"          "$WORK/bomb"     'limit=ratio observed=[0-9]+ threshold=200 depth=0 file=bomb.zip' ARTIFACT_MAX_FILE_BYTES=1000000000
diag "diagnostic: total bytes"    "$WORK/total"    'limit=total_bytes observed=[0-9]+ threshold=8000000 ' ARTIFACT_MAX_TOTAL_BYTES=8000000
diag "diagnostic: archive files"  "$WORK/many"     'limit=archive_files observed=20000 threshold=5000 depth=0 file=many.zip'
diag "diagnostic: folder files"   "$WORK/manydir"  'limit=files observed=21 threshold=20 '  ARTIFACT_MAX_FILES=20
diag "diagnostic: plain size"     "$WORK/huge"     'limit=file_bytes observed=2000000 threshold=1000000 depth=0 file=big.log' ARTIFACT_MAX_FILE_BYTES=1000000
mkdir -p "$WORK/slow"; for i in 1 2 3; do echo x > "$WORK/slow/$i.log"; done
diag "diagnostic: time"           "$WORK/slow"     'limit=seconds observed=[0-9-]+ threshold=-1 ' ARTIFACT_MAX_SECONDS=-1
diag "diagnostic: damaged (type only)" "$WORK/broken2" 'limit=damaged observed=- threshold=- depth=0 file=big.log.gz|limit=damaged .* detail=[A-Za-z]+'
# Names that look like credentials are hidden; the body is never printed.
d="$WORK/diag-name"; mkdir -p "$d"
python3 -c 'import zipfile,sys
with zipfile.ZipFile(sys.argv[1],"w") as z:
  z.writestr(sys.argv[2], b"PLANTED_BODY " + bytes(5_000_000), zipfile.ZIP_DEFLATED)' "$d/up.zip" "$FAKE_JWT.log"
diag "credential-looking name inside an archive is hidden" "$d" 'file=up.zip!\[name hidden\]|file=\[name hidden\]' ARTIFACT_MAX_FILE_BYTES=1000000
d="$WORK/diag-name2"; mkdir -p "$d"; head -c 5000 /dev/zero > "$d/password=hunter2.log"
diag "credential-looking plain file name is hidden" "$d" 'file=\[name hidden\]' ARTIFACT_MAX_FILE_BYTES=100
grep -q hunter2 "$WORK/diag.txt" && bad "hidden name still printed" || pass "hidden name never printed"
# Control characters and very long names are cleaned and cut.
d="$WORK/diag-ctl"; mkdir -p "$d"; long=$(printf 'a%.0s' $(seq 1 200))
head -c 5000 /dev/zero > "$d/$(printf 'evil\033[31mname')$long.log"
diag "control characters and long names are cleaned" "$d" 'file=evil31mnamea{100,120}\.\.\.' ARTIFACT_MAX_FILE_BYTES=100
grep -q $'\033' "$WORK/diag.txt" && bad "escape character printed" || pass "escape character never printed"
# A clean scan writes an ok report.
ARGS=("$WORK/n3"); run "$WORK/diag.txt" ARTIFACT_SCAN_REPORT="$WORK/ok.json"
python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert d["status"]=="ok" and d["limit"]=="" and int(d["files_scanned"])>0' "$WORK/ok.json" \
  && pass "clean scan writes an ok report" || bad "clean scan report"

# Encrypted archives and links: content that cannot be scanned must FAIL, and
# nothing may ever be written outside the temporary scan folder.
OUT="$WORK/outside"; mkdir -p "$OUT"   # must stay empty for every case below
outside_clean() { [ -z "$(ls -A "$OUT")" ] && [ ! -e /tmp/pwned-by-archive ]; }
sec() { # $1 = label, $2 = expected limit code, $3 = dir, rest = env
  expect_stop "$1" "limit=$2 " "$3" "${@:4}"
  outside_clean || { bad "$1: something was written outside the scan folder"; ls -la "$OUT"; rm -rf "$OUT"/* /tmp/pwned-by-archive; }
}
mk() { local d="$WORK/sec-$1"; rm -rf "$d"; mkdir -p "$d"; echo "$d"; }
echo "SECRET_CONTENT inside" > "$WORK/plain.log"
# Password-protected zip (classic zip encryption) and 7z AES zip.
d=$(mk enc); (cd "$WORK" && zip -q -P hunter2 "$d/locked.zip" plain.log)
sec "password-protected zip fails closed" encrypted "$d"
d=$(mk enc-aes); (cd "$WORK" && 7z a -tzip -mem=AES256 -phunter2 "$d/locked.zip" plain.log > /dev/null)
sec "AES-encrypted zip fails closed" encrypted "$d"
d=$(mk enc-nested); (cd "$WORK" && zip -q -P hunter2 "$WORK/inner-locked.zip" plain.log && python3 -c 'import zipfile,sys
with zipfile.ZipFile(sys.argv[1],"w") as z: z.write(sys.argv[2],"deep/inner.zip")' "$d/outer.zip" "$WORK/inner-locked.zip")
sec "password-protected zip inside a normal zip fails closed" encrypted "$d"
# Symlink members pointing outside (tar and zip), hard links, and devices.
d=$(mk tarlink); python3 -c 'import tarfile,sys
with tarfile.open(sys.argv[1],"w") as t:
  i=tarfile.TarInfo("escape"); i.type=tarfile.SYMTYPE; i.linkname=sys.argv[2]; t.addfile(i)' "$d/a.tar" "$OUT"
sec "tar symlink to an outside folder fails closed" link "$d"
d=$(mk tarlinkwrite); python3 -c 'import tarfile,sys,io
with tarfile.open(sys.argv[1],"w") as t:
  i=tarfile.TarInfo("escape"); i.type=tarfile.SYMTYPE; i.linkname=sys.argv[2]; t.addfile(i)
  b=b"written through the link"; j=tarfile.TarInfo("escape/pwned.txt"); j.size=len(b); t.addfile(j,io.BytesIO(b))' "$d/a.tar.gz" "$OUT"
mv "$d/a.tar.gz" "$d/a.tar"; sec "tar symlink followed by a write through it fails closed" link "$d"
d=$(mk tarhard); python3 -c 'import tarfile,sys
with tarfile.open(sys.argv[1],"w:gz") as t:
  i=tarfile.TarInfo("hard"); i.type=tarfile.LNKTYPE; i.linkname="/etc/passwd"; t.addfile(i)' "$d/a.tar.gz"
sec "tar hard link fails closed" link "$d"
d=$(mk tardev); python3 -c 'import tarfile,sys
with tarfile.open(sys.argv[1],"w") as t:
  for n,ty in (("dev",tarfile.CHRTYPE),("fifo",tarfile.FIFOTYPE)):
    i=tarfile.TarInfo(n); i.type=ty; t.addfile(i)' "$d/a.tar"
sec "tar device or pipe fails closed" special "$d"
d=$(mk ziplink); python3 -c 'import zipfile,sys,stat
with zipfile.ZipFile(sys.argv[1],"w") as z:
  i=zipfile.ZipInfo("escape"); i.external_attr=(stat.S_IFLNK|0o777)<<16; z.writestr(i, sys.argv[2])' "$d/a.zip" "$OUT"
sec "zip symlink member fails closed" link "$d"
# Path traversal: .., absolute paths and backslashes, in zip and tar.
d=$(mk zipdotdot); python3 -c 'import zipfile,sys
with zipfile.ZipFile(sys.argv[1],"w") as z: z.writestr("../../../../../../tmp/pwned-by-archive","x")' "$d/a.zip"
sec "zip entry with ../ fails closed" unsafe_path "$d"
d=$(mk zipabs); python3 -c 'import zipfile,sys
with zipfile.ZipFile(sys.argv[1],"w") as z:
  i=zipfile.ZipInfo("x"); z.writestr(i,"x")
  i.filename=sys.argv[2]+"/abs.txt"
with open(sys.argv[1],"r+b") as f: pass' "$d/a.zip" "$OUT"
python3 - "$d/a.zip" "$OUT" <<'PY'
import sys
b=open(sys.argv[1],"rb").read(); n=(sys.argv[2]+"/p.txt").encode()
# rewrite the one-char name "x" in both headers to an absolute path
import struct
out=bytearray(); i=0
lh=b.find(b"PK\x03\x04"); cd=b.find(b"PK\x01\x02"); eo=b.find(b"PK\x05\x06")
local=bytearray(b[lh:cd]); central=bytearray(b[cd:eo]); end=bytearray(b[eo:])
local[26:28]=struct.pack("<H",len(n)); local=local[:30]+n+local[31:]
central[28:30]=struct.pack("<H",len(n)); central=central[:46]+n+central[47:]
end[12:16]=struct.pack("<I",len(central)); end[16:20]=struct.pack("<I",len(local))
open(sys.argv[1],"wb").write(bytes(local+central+end))
PY
sec "zip entry with an absolute path fails closed" unsafe_path "$d"
d=$(mk tardotdot); python3 -c 'import tarfile,sys,io
with tarfile.open(sys.argv[1],"w") as t:
  b=b"x"; i=tarfile.TarInfo("ok/../../../../tmp/pwned-by-archive"); i.size=1; t.addfile(i,io.BytesIO(b))' "$d/a.tar"
sec "tar entry with ../ fails closed" unsafe_path "$d"
d=$(mk tarabs); python3 -c 'import tarfile,sys,io
with tarfile.open(sys.argv[1],"w") as t:
  b=b"x"; i=tarfile.TarInfo(sys.argv[2]+"/abs.txt"); i.size=1; t.addfile(i,io.BytesIO(b))' "$d/a.tar" "$OUT"
sec "tar entry with an absolute path fails closed" unsafe_path "$d"
d=$(mk zipbs); python3 -c 'import zipfile,sys
with zipfile.ZipFile(sys.argv[1],"w") as z: z.writestr("..\\..\\..\\tmp\\pwned-by-archive","x")' "$d/a.zip"
ARGS=("$d"); run "$WORK/out.txt" || true
outside_clean && pass "zip entry with backslash hops writes nothing outside" || bad "backslash hop wrote outside"
# Links in the uploaded folder itself are not followed or skipped silently.
d=$(mk dirlink); echo "SECRET_CONTENT" > "$OUT/../secret-target.log"; ln -s "$OUT/../secret-target.log" "$d/looks-harmless.log"
sec "symlink file in the upload folder fails closed" link "$d"
d=$(mk dirlink2); ln -s "$OUT" "$d/linked-folder"
sec "symlink folder in the upload folder fails closed" link "$d"
d=$(mk top); echo x > "$d/real.log"; ln -s "$d" "$WORK/top-link"
ARGS=("$WORK/top-link"); run "$WORK/out.txt" && bad "upload path that is itself a link passed" \
  || { grep -q "limit=link " "$WORK/out.txt" && pass "upload path that is itself a link fails closed" || { bad "top link reason"; cat "$WORK/out.txt"; }; }
d=$(mk fifo); mkfifo "$d/pipe.log"
sec "named pipe in the upload folder fails closed" special "$d"
# Hidden password never printed; JSON report names the limit.
grep -rq hunter2 "$WORK/out.txt" "$WORK/diag.txt" 2>/dev/null && bad "archive password printed" || pass "archive password never printed"
d=$(mk enc-rep); (cd "$WORK" && zip -q -P hunter2 "$d/locked.zip" plain.log)
ARGS=("$d"); run "$WORK/out.txt" ARTIFACT_SCAN_REPORT="$WORK/enc.json" || true
python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert d["status"]=="limit" and d["limit"]=="encrypted" and d["file"]=="locked.zip!plain.log", d' "$WORK/enc.json" \
  && pass "report names the encrypted file" || { bad "encrypted report"; cat "$WORK/enc.json"; }
outside_clean && pass "nothing written outside the scan folder in any case" || bad "outside folder not empty"

# Time limit.
mkdir -p "$WORK/slow"; for i in 1 2 3; do echo x > "$WORK/slow/$i.log"; done
expect_stop "time limit" "longer than" "$WORK/slow" ARTIFACT_MAX_SECONDS=-1

# A leak found before a limit is hit is still reported by file name.
mkdir -p "$WORK/leakfirst"; echo "SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnopqrstu" > "$WORK/leakfirst/a.log"
ARGS=("$WORK/leakfirst"); run "$WORK/out.txt" || true
grep -q "a.log contains a backend credential" "$WORK/out.txt" && pass "leaks still reported with safeguards on" || { bad "leak not reported"; cat "$WORK/out.txt"; }

[ "$fail" = 0 ] && echo "All archive limit checks passed." || echo "Archive limit checks FAILED."
exit $fail
