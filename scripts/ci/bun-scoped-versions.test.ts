import { expect, it } from "vitest";
import { bunInstalledVersions } from "./bun-installed-versions.mjs";

it("does not mistake a scoped package for an unscoped suffix", () => {
  expect(
    bunInstalledVersions(
      '{"packages":{"@types/dompurify":["@types/dompurify@3.0.5"]}}',
      "dompurify",
      process.cwd(),
    ),
  ).toEqual([]);
});

it("still inspects nested copies under scoped parents", () => {
  expect(
    bunInstalledVersions(
      '{"packages":{"@scope/parent/picomatch":["picomatch@4.0.3"]}}',
      "picomatch",
      process.cwd(),
    ),
  ).toEqual([{ path: "bun.lock:@scope/parent/picomatch", version: "4.0.3" }]);
});
