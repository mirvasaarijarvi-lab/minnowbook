/**
 * Minimal line-based unified diff used by the support-chat snapshot test to
 * make snapshot regressions readable without pulling in a runtime dep.
 *
 * Returns "" when the inputs are identical. Output mimics the standard
 * `diff -u` shape: `--- expected`, `+++ actual`, hunk headers `@@ -a,b +c,d @@`,
 * and `+`/`-`/` ` line prefixes.
 */
export function unifiedDiff(expected: string, actual: string, context = 3): string {
  const a = expected.split("\n");
  const b = actual.split("\n");
  if (a.join("\n") === b.join("\n")) return "";

  const m = a.length;
  const n = b.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  type Op = { tag: " " | "-" | "+"; line: string };
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ops.push({ tag: " ", line: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ tag: "-", line: a[i++] });
    } else {
      ops.push({ tag: "+", line: b[j++] });
    }
  }
  while (i < m) ops.push({ tag: "-", line: a[i++] });
  while (j < n) ops.push({ tag: "+", line: b[j++] });

  const changedIdx = ops
    .map((op, idx) => (op.tag === " " ? -1 : idx))
    .filter((idx) => idx !== -1);
  if (changedIdx.length === 0) return "";

  const hunks: Array<{ start: number; end: number }> = [];
  let curStart = Math.max(0, changedIdx[0] - context);
  let curEnd = Math.min(ops.length - 1, changedIdx[0] + context);
  for (let k = 1; k < changedIdx.length; k++) {
    const idx = changedIdx[k];
    if (idx - context <= curEnd + 1) {
      curEnd = Math.min(ops.length - 1, idx + context);
    } else {
      hunks.push({ start: curStart, end: curEnd });
      curStart = Math.max(0, idx - context);
      curEnd = Math.min(ops.length - 1, idx + context);
    }
  }
  hunks.push({ start: curStart, end: curEnd });

  const out: string[] = ["--- expected (snapshot)", "+++ actual (current source)"];
  for (const { start, end } of hunks) {
    let aStart = 0;
    let bStart = 0;
    let aCount = 0;
    let bCount = 0;
    for (let k = 0; k < start; k++) {
      if (ops[k].tag !== "+") aStart++;
      if (ops[k].tag !== "-") bStart++;
    }
    for (let k = start; k <= end; k++) {
      if (ops[k].tag !== "+") aCount++;
      if (ops[k].tag !== "-") bCount++;
    }
    out.push(`@@ -${aStart + 1},${aCount} +${bStart + 1},${bCount} @@`);
    for (let k = start; k <= end; k++) {
      out.push(`${ops[k].tag}${ops[k].line}`);
    }
  }
  return out.join("\n");
}
