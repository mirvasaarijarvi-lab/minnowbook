// Regression test: guarantees `bun install --frozen-lockfile` succeeds
// against a fresh checkout (no node_modules, no warm cache hint), so a CI
// drift between package.json and bun.lock fails *here* instead of in a
// downstream job. Drift incidents (e.g. @types/node, dompurify pin) have
// repeatedly slipped past local installs because they reuse the existing
// node_modules tree; this test reproduces the CI shape by copying the lock
// inputs to a clean temp directory and running the real bun binary.
import { describe, it, expect } from "vitest";
import { spawnSync, execSync } from "node:child_process";
import { mkdtempSync, copyFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const HAS_BUN = (() => {
  try {
    execSync("bun --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

// Network-dependent; allow opt-out for offline contributors but always run
// on CI where BUN drift is the failure mode we're guarding against.
const SHOULD_RUN = HAS_BUN && process.env.SKIP_BUN_FROZEN_LOCKFILE_TEST !== "1";

describe.runIf(SHOULD_RUN)("bun install --frozen-lockfile", () => {
  it(
    "succeeds in a clean temp directory (lockfile is in sync with package.json)",
    () => {
      const tmp = mkdtempSync(path.join(tmpdir(), "bun-frozen-"));
      try {
        for (const f of ["package.json", "bun.lock"]) {
          const src = path.join(REPO_ROOT, f);
          expect(existsSync(src), `${f} must exist at repo root`).toBe(true);
          copyFileSync(src, path.join(tmp, f));
        }
        // Avoid accidentally inheriting a project .npmrc / .env that would
        // tweak resolution; write an empty .npmrc so bun uses defaults.
        writeFileSync(path.join(tmp, ".npmrc"), "");

        const result = spawnSync(
          "bun",
          ["install", "--frozen-lockfile", "--ignore-scripts", "--no-summary"],
          {
            cwd: tmp,
            encoding: "utf8",
            timeout: 180_000,
            env: {
              ...process.env,
              // Force a deterministic, non-interactive run.
              CI: "1",
              NO_COLOR: "1",
            },
          },
        );

        if (result.status !== 0) {
          // Surface the exact CI failure mode in the assertion message so
          // contributors don't have to re-run the job to diagnose drift.
          const out = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
          throw new Error(
            `bun install --frozen-lockfile failed (exit ${result.status}).\n` +
              `Fix locally with:  bun install --save-text-lockfile\n` +
              `Then commit bun.lock.\n\n--- bun output ---\n${out}`,
          );
        }

        expect(result.status).toBe(0);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    },
    200_000,
  );
});
