import { afterEach, describe, expect, it } from "vitest";
import DOMPurify from "dompurify";

/**
 * Regression test for GHSA-cmwh-pvxp-8882 ("permanent hook pollution")
 * in DOMPurify <3.4.7. The original PoC:
 *
 *   1. Register a global `uponSanitizeAttribute` hook that mutates
 *      `data.allowedAttributes` to permit a dangerous attribute
 *      (e.g. `onerror`) for one specific element.
 *   2. Call `DOMPurify.setConfig({...})` to lock in that config.
 *   3. On a later, unrelated `sanitize()` call the mutation persists,
 *      so an attacker-supplied `<img src=x onerror=alert(1)>` keeps
 *      its `onerror` handler and fires on insertion - stored XSS with
 *      no user interaction.
 *
 * Patched DOMPurify (>=3.4.7, hardened again in 3.4.11) makes the
 * hook's mutation non-persistent: allowing an attribute for one
 * element no longer leaks into later sanitize() calls.
 *
 * This test reproduces the PoC end to end and asserts the dangerous
 * attribute is stripped on every follow-up call. If the floor ever
 * regresses below the patched version, this test fails loudly.
 *
 * All mutations are performed on an isolated `createDOMPurify(window)`
 * instance so the shared singleton used by the rest of the test suite
 * is never polluted, even transiently.
 */
describe("DOMPurify regression: GHSA-cmwh-pvxp-8882 attribute leak", () => {
  // Each test gets a fresh isolated instance bound to jsdom's window.
  // We still defensively `removeAllHooks()` after each test so a future
  // refactor that reuses the singleton cannot silently cross-pollute.
  let purify: ReturnType<typeof DOMPurify>;

  afterEach(() => {
    purify?.removeAllHooks();
  });

  it("does not leak attribute allow-list across sanitize() calls", () => {
    purify = DOMPurify(window);

    // Step 1: the malicious hook from the PoC. It claims to only
    // allow `onerror` for a single benign element, but the bug let
    // that mutation persist process-wide.
    purify.addHook("uponSanitizeAttribute", (_node, data) => {
      if (data.attrName === "onerror") {
        // The historical bug: directly mutating allowedAttributes.
        // On unpatched versions this leaks into every later call.
        (data as unknown as {
          allowedAttributes: Record<string, boolean>;
        }).allowedAttributes.onerror = true;
      }
    });

    // Step 2: lock in a config, mirroring the PoC harness. The PoC
    // explicitly noted "the same harness without the setConfig() line
    // strips onerror and does not fire", so setConfig() is what arms
    // the leak - the config payload itself does not need to allow
    // onerror.
    purify.setConfig({ USE_PROFILES: { html: true } });

    // Prime the pump - one sanitize call that "uses" the hook.
    purify.sanitize(`<span onerror="primer()">x</span>`);

    // Step 3: remove the hook and perform follow-up calls. On a
    // vulnerable build the earlier mutation persists and onerror
    // survives. On a patched build every follow-up call strips it.
    purify.removeAllHooks();

    const payloads = [
      `<img src=x onerror="alert('XSS')">`,
      `<svg><image href=x onerror="alert(1)" /></svg>`,
      `<body onerror="alert(2)">hi</body>`,
      `<video><source onerror="alert(3)"></video>`,
    ];

    for (const dirty of payloads) {
      const clean = purify.sanitize(dirty);
      const lowered = clean.toLowerCase();
      expect(
        lowered,
        `onerror leaked into follow-up sanitize() for: ${dirty}\n  -> ${clean}`,
      ).not.toContain("onerror");
      expect(lowered).not.toContain("alert");
    }
  });

  it("does not leak even when the hook stays registered for later calls", () => {
    purify = DOMPurify(window);

    // Hook mutates allowedAttributes for element A only. The bug
    // caused that allowance to apply to element B in a later call.
    purify.addHook("uponSanitizeAttribute", (node, data) => {
      if (
        node.nodeName === "DIV" &&
        data.attrName === "onmouseover"
      ) {
        (data as unknown as {
          allowedAttributes: Record<string, boolean>;
        }).allowedAttributes.onmouseover = true;
      }
    });
    purify.setConfig({ USE_PROFILES: { html: true } });

    // Use the allowance once on the "approved" element shape.
    purify.sanitize(`<div onmouseover="ok()">a</div>`);

    // Now sanitize a *different* element - the mutation must NOT
    // carry over. We keep the hook registered to prove the patch
    // resets allowedAttributes per attribute callback, not just per
    // top-level sanitize() call.
    const dirty = `<img src=x onmouseover="alert('leak')">`;
    const clean = purify.sanitize(dirty);
    expect(clean.toLowerCase()).not.toContain("alert");
    // The hook only re-allows onmouseover on DIV nodes; for <img>
    // the attribute must be stripped.
    expect(clean.toLowerCase()).not.toMatch(/<img[^>]*onmouseover/);
  });
});
