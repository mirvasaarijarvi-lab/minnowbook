/**
 * Unit tests for `sanitizeError` in the admin-users edge function.
 *
 * Why this matters: the dashboard's tier-error UI (parseTierLimitError +
 * useTierErrorMessage) only works if the edge function passes the raw
 * trigger message through verbatim. If sanitizeError accidentally
 * swallowed those messages and replaced them with the generic
 * "An unexpected error occurred" copy, admins would just see a useless
 * toast instead of "Tier 'basic' allows at most 5 staff users…" with
 * an upgrade CTA.
 *
 * These tests lock in the whitelist behavior:
 *   1. The hard-coded SAFE_ERRORS literals pass through.
 *   2. Validator-prefixed messages (Email/Password/Display name/Role/Invalid…)
 *      pass through.
 *   3. All four DB-trigger tier-limit messages pass through.
 *   4. The duplicate-tenant-membership trigger message passes through.
 *   5. Anything else is replaced with the generic copy.
 *
 * Run locally with:
 *   deno test --allow-net --allow-env --allow-read \
 *     supabase/functions/admin-users/sanitize-error.test.ts
 */

import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  GENERIC_ERROR_MESSAGE,
  SAFE_ERRORS,
  sanitizeError,
} from "./sanitize-error.ts";

// Silence the `console.error("[admin-users] Internal error:", msg)` line
// for the negative-path tests so the test output stays readable. We
// restore it after the suite so other tests in the same Deno process
// keep their normal logging.
const originalConsoleError = console.error;
function muteConsoleError() {
  console.error = () => {};
}
function restoreConsoleError() {
  console.error = originalConsoleError;
}

Deno.test("sanitizeError: passes through every hard-coded SAFE_ERRORS literal", () => {
  for (const literal of SAFE_ERRORS) {
    assertEquals(
      sanitizeError(literal),
      literal,
      `Expected SAFE_ERRORS literal "${literal}" to pass through unchanged`,
    );
  }
});

Deno.test("sanitizeError: passes through validator-prefixed messages", () => {
  const validatorMessages = [
    "Email is required",
    "Email too long",
    "Invalid email format",
    "Password is required",
    "Password must be at least 12 characters",
    "Password must contain an uppercase letter",
    "Display name too long",
    "Role is required",
    "Invalid role",
  ];
  for (const msg of validatorMessages) {
    assertEquals(
      sanitizeError(msg),
      msg,
      `Expected validator message "${msg}" to pass through unchanged`,
    );
  }
});

Deno.test(
  "sanitizeError: passes through tier-limit messages from enforce_staff_user_limit",
  () => {
    const msg =
      'Tier "basic" allows at most 5 staff user(s). Upgrade your plan to add more.';
    assertEquals(sanitizeError(msg), msg);
    assertNotEquals(sanitizeError(msg), GENERIC_ERROR_MESSAGE);
  },
);

Deno.test(
  "sanitizeError: passes through tier-limit messages from enforce_site_limit",
  () => {
    const msg = 'Tier "professional" allows at most 1 site(s). Upgrade to add more.';
    assertEquals(sanitizeError(msg), msg);
  },
);

Deno.test(
  "sanitizeError: passes through tier-limit messages from enforce_reservation_type_limit",
  () => {
    // Same Tier "%" allows at most %  prefix as the other two — covered
    // by the same regex branch.
    const msg =
      'Tier "basic" allows at most 1 reservation type(s). Upgrade to add more.';
    assertEquals(sanitizeError(msg), msg);
  },
);

Deno.test(
  "sanitizeError: passes through resource-per-type limit messages",
  () => {
    const msg =
      "Your plan allows only 1 resource(s) per type. Upgrade to Business for unlimited resources.";
    assertEquals(sanitizeError(msg), msg);
  },
);

Deno.test(
  "sanitizeError: passes through duplicate-tenant-membership messages",
  () => {
    const msg = "User already belongs to another organization";
    assertEquals(sanitizeError(msg), msg);

    // Case-insensitive — the trigger may emit different casings.
    const msg2 = "This account Already Belongs To Another Organization.";
    assertEquals(sanitizeError(msg2), msg2);
  },
);

Deno.test(
  "sanitizeError: replaces unknown / internal Postgres errors with the generic copy",
  () => {
    muteConsoleError();
    try {
      const internalErrors = [
        'duplicate key value violates unique constraint "users_email_key"',
        'null value in column "tenant_id" of relation "reservations" violates not-null constraint',
        "permission denied for table reservations",
        "relation \"public.secret_table\" does not exist",
        "syntax error at or near \"SELECT\"",
      ];
      for (const msg of internalErrors) {
        assertEquals(
          sanitizeError(msg),
          GENERIC_ERROR_MESSAGE,
          `Expected internal error "${msg}" to be replaced with the generic copy`,
        );
      }
    } finally {
      restoreConsoleError();
    }
  },
);

Deno.test(
  "sanitizeError: does NOT match tier-like text that lacks the exact prefix",
  () => {
    // Defensive: a Postgres error that happens to mention 'Tier' deeper in
    // the message (e.g. inside a HINT / DETAIL block) must NOT bypass the
    // sanitizer just because the substring exists.
    muteConsoleError();
    try {
      const sneaky =
        'ERROR: relation "tiers" does not exist  HINT: maybe you meant Tier "basic" allows at most 5';
      assertEquals(sanitizeError(sneaky), GENERIC_ERROR_MESSAGE);
    } finally {
      restoreConsoleError();
    }
  },
);

Deno.test(
  "sanitizeError: tier message with malformed quotes falls back to generic",
  () => {
    // The whitelist regex requires the tier name to be wrapped in straight
    // double quotes ("..."). Smart quotes / missing quotes should NOT match.
    muteConsoleError();
    try {
      const malformed = "Tier basic allows at most 5 staff user(s).";
      assertEquals(sanitizeError(malformed), GENERIC_ERROR_MESSAGE);
    } finally {
      restoreConsoleError();
    }
  },
);
