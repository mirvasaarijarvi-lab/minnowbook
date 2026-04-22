/**
 * Lightweight UI test for the Forbidden page.
 *
 * Goal: verify the visible message, document title, and meta tags render
 * correctly for the variety of `attemptedArea` strings non-admin roles
 * encounter in the app — Superadmin, dashboard sub-areas, audit log, etc.
 *
 * Strategy:
 *   - Render `<Forbidden />` directly (no router needed; the component
 *     only uses `<Link>` which works inside MemoryRouter).
 *   - Mock the supabase client at the import-path level so the page's
 *     two beacons (`forbidden-status` and `log-forbidden-access`) are
 *     no-ops in jsdom and don't trigger network errors.
 *   - For each role/area pair, assert:
 *       * The body copy mentions the attempted area
 *       * The 403 marker is visible
 *       * `document.title` is "Access denied — 403"
 *       * `<meta name="robots">` is `noindex, nofollow`
 *       * `<meta http-equiv="Status">` is `403 Forbidden`
 *       * `<main data-http-status="403">` is set
 *
 * The test deliberately does NOT exercise the beacon network paths —
 * those are validated separately. We only care here about the rendered
 * surface area that monitoring, accessibility tools, and end users see.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks ---------------------------------------------------------------

// The Forbidden page uses supabase.auth.getSession() to gate the audit
// beacon and (indirectly via raw fetch) the forbidden-status beacon.
// Returning a null session short-circuits the audit beacon entirely;
// the forbidden-status beacon uses raw fetch, which we stub globally
// below to avoid jsdom network errors.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
    },
    functions: {
      invoke: vi.fn(async () => ({ data: null, error: null })),
    },
  },
}));

// --- Imports under test (after mocks) ------------------------------------

import Forbidden from "./Forbidden";

// --- Setup ---------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Reset document head between tests so meta tags from a previous render
  // can't leak into the next assertion. Title is restored by the page's
  // own cleanup, but we belt-and-braces it.
  document.title = "";
  document
    .querySelectorAll('meta[name="robots"], meta[http-equiv="Status"]')
    .forEach((el) => el.remove());

  // Stub the global fetch the hardened beacon uses so it resolves silently
  // in jsdom (no real network) and doesn't pollute test output with errors.
  // The promise never rejects — matching the fire-and-forget contract.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 403 })),
  );
});

// Render harness — Forbidden uses <Link>, which requires a Router context.
const renderForbidden = (props: React.ComponentProps<typeof Forbidden> = {}) =>
  render(
    <MemoryRouter>
      <Forbidden {...props} />
    </MemoryRouter>,
  );

// --- Test matrix ---------------------------------------------------------

// Each row models a non-admin role hitting an area they're not entitled to.
// `attemptedArea` is the prop the route guard would pass; `expectedCopy`
// is the substring we expect to find embedded in the body paragraph.
const roleScenarios: Array<{
  role: string;
  attemptedArea: string;
  expectedCopy: RegExp;
}> = [
  {
    role: "owner attempting Superadmin",
    attemptedArea: "the Superadmin area",
    expectedCopy: /permission to access the Superadmin area/i,
  },
  {
    role: "admin attempting platform Audit Log",
    attemptedArea: "the platform audit log",
    expectedCopy: /permission to access the platform audit log/i,
  },
  {
    role: "staff attempting Settings",
    attemptedArea: "tenant settings",
    expectedCopy: /permission to access tenant settings/i,
  },
  {
    role: "staff attempting Reports",
    attemptedArea: "the reports dashboard",
    expectedCopy: /permission to access the reports dashboard/i,
  },
  {
    role: "custom role attempting Beta Feedback panel",
    attemptedArea: "the beta feedback panel",
    expectedCopy: /permission to access the beta feedback panel/i,
  },
];

// --- Tests ---------------------------------------------------------------

describe("Forbidden page (UI surface for non-admin roles)", () => {
  it.each(roleScenarios)(
    "renders the expected message, title, and meta tags for: $role",
    ({ attemptedArea, expectedCopy }) => {
      renderForbidden({ attemptedArea });

      // 1. The 403 marker is visible — the universal cue that this is
      //    the denial screen and not a generic error.
      expect(screen.getByText(/403 · Access denied/i)).toBeInTheDocument();

      // 2. The body copy mentions the specific area the user tried to
      //    reach. This is the role-specific signal.
      expect(screen.getByText(expectedCopy)).toBeInTheDocument();

      // 3. The H1 is stable and accessible.
      expect(
        screen.getByRole("heading", { level: 1, name: /you don't have access/i }),
      ).toBeInTheDocument();

      // 4. The document title is the canonical 403 title — synthetic
      //    monitors and screen readers both rely on it.
      expect(document.title).toBe("Access denied — 403");

      // 5. <meta name="robots"> excludes the page from search indexes.
      const robots = document.querySelector('meta[name="robots"]');
      expect(robots?.getAttribute("content")).toBe("noindex, nofollow");

      // 6. <meta http-equiv="Status"> emits the closest thing to a real
      //    status code from a static document. Crawlers and proxies
      //    that respect the hint will treat the page as 403.
      const status = document.querySelector('meta[http-equiv="Status"]');
      expect(status?.getAttribute("content")).toBe("403 Forbidden");

      // 7. The <main> element advertises the status via a stable data
      //    attribute — used by Playwright tests and a11y tooling.
      const main = screen.getByRole("main");
      expect(main).toHaveAttribute("data-http-status", "403");

      cleanup();
    },
  );

  it("falls back to the default 'this area' phrasing when no attemptedArea prop is given", () => {
    renderForbidden();

    // Default copy should mention the generic area phrasing.
    expect(
      screen.getByText(/permission to access this area/i),
    ).toBeInTheDocument();

    // All universal markers still apply.
    expect(document.title).toBe("Access denied — 403");
    expect(
      document.querySelector('meta[name="robots"]')?.getAttribute("content"),
    ).toBe("noindex, nofollow");
    expect(
      document.querySelector('meta[http-equiv="Status"]')?.getAttribute("content"),
    ).toBe("403 Forbidden");
  });

  it("renders a custom message verbatim when provided, overriding the area-based default", () => {
    const customMessage =
      "Your custom role does not include the 'reports.export' permission. Ask an owner to grant it.";
    renderForbidden({
      attemptedArea: "the reports export",
      message: customMessage,
    });

    // The custom message wins over the default area-based copy.
    expect(screen.getByText(customMessage)).toBeInTheDocument();
    // And the default phrasing for the same area must NOT also be rendered.
    expect(
      screen.queryByText(/permission to access the reports export/i),
    ).not.toBeInTheDocument();
  });
});
