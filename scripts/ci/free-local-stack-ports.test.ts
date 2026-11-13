import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function run(failRemoval = false) {
  const directory = mkdtempSync(join(tmpdir(), "stack-ports-"));
  directories.push(directory);
  const calls = join(directory, "calls");
  writeFileSync(calls, "");
  writeFileSync(
    join(directory, "docker"),
    `#!/usr/bin/env bash
set -eu
case "$1" in
  ps) printf 'database\nstopped\nunrelated\n' ;;
  inspect)
    case "\${@: -1}" in
      database) echo '{"5432/tcp":[{"HostIp":"0.0.0.0","HostPort":"54322"}]}' ;;
      stopped) echo '{"80/tcp":[{"HostIp":"::","HostPort":"54321"}]}' ;;
      unrelated) echo '{"54322/tcp":[{"HostIp":"0.0.0.0","HostPort":"15432"}]}' ;;
    esac ;;
  rm) echo "\${@: -1}" >> "$CALLS"; exit "$FAIL_REMOVAL" ;;
  *) exit 2 ;;
esac
`,
    { mode: 0o755 },
  );
  writeFileSync(join(directory, "sudo"), "#!/usr/bin/env bash\nexit 0\n", {
    mode: 0o755,
  });
  const result = spawnSync(
    "bash",
    [resolve("scripts/ci/free-local-stack-ports.sh")],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        CALLS: calls,
        FAIL_REMOVAL: failRemoval ? "1" : "0",
      },
    },
  );
  return { ...result, removed: readFileSync(calls, "utf8").trim().split("\n") };
}

describe("local stack host-port cleanup", () => {
  it("removes running and stopped containers mapped to reserved host ports, not unrelated container ports", () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.removed).toEqual(["database", "stopped"]);
  });

  it("fails when a conflicting container cannot be removed", () => {
    const result = run(true);
    expect(result.status).toBe(1);
    expect(result.removed).toEqual(["database"]);
  });
});
