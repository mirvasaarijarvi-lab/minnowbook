import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const SCRIPT = resolve(__dirname, "check-security-regressions.mjs");

function run(payload: unknown) {
  const res = spawnSync("node", [SCRIPT], {
    input: JSON.stringify(payload),
    encoding: "utf8",
  });
  return { code: res.status ?? -1, stdout: res.stdout, stderr: res.stderr };
}

describe("check-security-regressions", () => {
  it("passes when advisors returns no lints", () => {
    const r = run({ lints: [] });
    expect(r.code).toBe(0);
  });

  it("passes when lints do not match any baseline entry", () => {
    const r = run({
      lints: [
        {
          name: "some_unrelated_advisor",
          level: "WARN",
          description: "not tracked",
          metadata: { schema: "public", name: "unrelated_table" },
        },
      ],
    });
    expect(r.code).toBe(0);
  });

  it("fails when a baseline-tracked table re-appears in an RLS lint (WARN)", () => {
    const r = run({
      lints: [
        {
          name: "rls_disabled_in_public",
          level: "WARN",
          description: "RLS disabled",
          metadata: { schema: "public", name: "resource_images" },
        },
      ],
    });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("resource_images_unconditional_public_select");
  });

  it("fails on the class rule rls_disabled_in_public for any public table", () => {
    const r = run({
      lints: [
        {
          name: "rls_disabled_in_public",
          level: "WARN",
          description: "RLS disabled",
          metadata: { schema: "public", name: "brand_new_table" },
        },
      ],
    });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("class_rls_disabled_public");
  });

  it("fails on security_definer_view class rule", () => {
    const r = run({
      lints: [
        {
          name: "security_definer_view",
          level: "WARN",
          description: "View is SECURITY DEFINER",
          metadata: { schema: "public", name: "some_view" },
        },
      ],
    });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("class_security_definer_view");
  });

  it("fails on function_search_path_mutable class rule", () => {
    const r = run({
      lints: [
        {
          name: "function_search_path_mutable",
          level: "WARN",
          description: "search_path is mutable",
          metadata: { schema: "public", name: "my_definer_fn" },
        },
      ],
    });
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("class_function_search_path_mutable");
  });

  it("does not match a class rule scoped to public when schema differs", () => {
    const r = run({
      lints: [
        {
          name: "rls_disabled_in_public",
          level: "WARN",
          description: "RLS disabled",
          metadata: { schema: "auth", name: "users" },
        },
      ],
    });
    expect(r.code).toBe(0);
  });

  it("exit code 2 on non-JSON stdin", () => {
    const res = spawnSync("node", [SCRIPT], { input: "not json", encoding: "utf8" });
    expect(res.status).toBe(2);
  });
});
