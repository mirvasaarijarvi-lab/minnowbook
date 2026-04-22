import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import ConfirmationEmailPreview from "@/components/ConfirmationEmailPreview";

/**
 * Security regression test for ConfirmationEmailPreview.
 *
 * The component renders `customMessage` via `dangerouslySetInnerHTML` after
 * passing it through `DOMPurify.sanitize(...)` with an allowlist of safe tags
 * and attributes. If a future refactor removes the sanitizer or widens the
 * allowlist to include script-bearing tags/attributes, these tests must fail.
 *
 * We assert two things for every payload:
 *   1. No executable surface ends up in the DOM (no <script>, <iframe>,
 *      <object>, <embed>, no inline event handlers, no javascript: URLs,
 *      no srcdoc, no eval-like style values).
 *   2. Side-effects an attacker would attempt (window.alert, image error
 *      handlers firing) never occur during render.
 */

const baseReservation = {
  guest_name: "Alice",
  guest_email: "alice@example.com",
  date: "2025-06-01",
  reservation_type: "restaurant",
  guests_count: 2,
};

const baseBusiness = {
  business_name: "Test Bistro",
};

const renderPreview = (customMessage: string) =>
  render(
    <ConfirmationEmailPreview
      reservation={baseReservation}
      business={baseBusiness}
      customMessage={customMessage}
    />
  );

const XSS_PAYLOADS: { name: string; payload: string }[] = [
  {
    name: "raw script tag",
    payload: '<script>window.__xss_fired = true;</script><p>after</p>',
  },
  {
    name: "img onerror handler",
    payload: '<img src="x" onerror="window.__xss_fired = true" />',
  },
  {
    name: "anchor with javascript: URL",
    payload: '<a href="javascript:window.__xss_fired=true">click</a>',
  },
  {
    name: "iframe injection",
    payload: '<iframe src="https://evil.example.com"></iframe>',
  },
  {
    name: "svg onload handler",
    payload: '<svg onload="window.__xss_fired = true"><circle r="5"/></svg>',
  },
  {
    name: "object/embed injection",
    payload:
      '<object data="evil.swf"></object><embed src="evil.swf"></embed>',
  },
  {
    name: "form-based phishing",
    payload:
      '<form action="https://evil.example.com"><input name="pw"/></form>',
  },
  {
    name: "meta refresh redirect",
    payload: '<meta http-equiv="refresh" content="0;url=https://evil.example.com">',
  },
  {
    name: "iframe srcdoc payload",
    payload: '<iframe srcdoc="<script>window.__xss_fired=true</script>"></iframe>',
  },
  {
    name: "data: URI in anchor",
    payload:
      '<a href="data:text/html,<script>window.__xss_fired=true</script>">x</a>',
  },
];

afterEach(() => {
  cleanup();
  // Reset any sentinel an attacker payload might have set.
  delete (window as unknown as { __xss_fired?: boolean }).__xss_fired;
});

describe("ConfirmationEmailPreview — customMessage sanitization", () => {
  it("renders nothing when customMessage is empty", () => {
    const { container } = renderPreview("");
    // No injected DOM should exist beyond the component's own structure.
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it.each(XSS_PAYLOADS)(
    "neutralises XSS payload: $name",
    ({ payload }) => {
      const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
      const { container } = renderPreview(payload);
      const html = container.innerHTML;

      // 1. No executable / framed elements survived sanitization.
      expect(container.querySelector("script")).toBeNull();
      expect(container.querySelector("iframe")).toBeNull();
      expect(container.querySelector("object")).toBeNull();
      expect(container.querySelector("embed")).toBeNull();
      expect(container.querySelector("form")).toBeNull();
      expect(container.querySelector("meta")).toBeNull();

      // 2. No inline event handlers leaked through.
      expect(html).not.toMatch(/\son\w+\s*=/i);

      // 3. No javascript: pseudo-URLs survived on hrefs.
      expect(html).not.toMatch(/href\s*=\s*["']?\s*javascript:/i);

      // 4. No srcdoc attribute (allows nested HTML execution in iframes).
      expect(html).not.toMatch(/\bsrcdoc\s*=/i);

      // 5. No data: URI hrefs (DOMPurify strips dangerous schemes by default).
      expect(html).not.toMatch(/href\s*=\s*["']?\s*data:/i);

      // 6. The attacker payload's side-effect sentinel never fired.
      expect(
        (window as unknown as { __xss_fired?: boolean }).__xss_fired
      ).toBeUndefined();
      expect(alertSpy).not.toHaveBeenCalled();

      alertSpy.mockRestore();
    }
  );

  it("preserves safe formatting tags from the allowlist", () => {
    const safe =
      '<p>Welcome <strong>Alice</strong>, your booking is <em>confirmed</em>.</p>' +
      '<ul><li>Item one</li><li>Item two</li></ul>' +
      '<a href="https://example.com" target="_blank">link</a>';
    const { container } = renderPreview(safe);
    const html = container.innerHTML;

    expect(container.querySelector("strong")).not.toBeNull();
    expect(container.querySelector("em")).not.toBeNull();
    expect(container.querySelector("ul")).not.toBeNull();
    expect(container.querySelectorAll("li")).toHaveLength(2);

    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute("href")).toBe("https://example.com");

    // Sanity: still no executable surface.
    expect(html).not.toMatch(/\son\w+\s*=/i);
    expect(container.querySelector("script")).toBeNull();
  });

  it("strips disallowed tags but keeps their inner text content", () => {
    const mixed = '<script>alert(1)</script><p>visible text</p>';
    const { container } = renderPreview(mixed);

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("visible text");
  });

  it("does not invoke the customMessage as a React child string", () => {
    // Defence-in-depth: ensure the raw payload string is not rendered as
    // text either (which would be safe but would indicate the sanitizer was
    // skipped). The sanitized HTML for a script tag is an empty string.
    const { container } = renderPreview("<script>alert(1)</script>");
    expect(container.textContent).not.toContain("<script>");
    expect(container.textContent).not.toContain("alert(1)");
  });
});
