# Tier-based staff user limit — end-to-end flow

This doc traces what happens when an admin tries to add a staff user, from the
tier configuration in the database all the way to the localized toast the
dashboard shows when the limit is hit.

## 1. Tier configuration (DB)

`public.get_tier_max_staff_users(p_tier text) → integer`

Pure lookup, `STABLE SECURITY DEFINER`. Returns the cap per tier:

| Tier           | Max staff users |
| -------------- | --------------- |
| `basic`        | 5               |
| `professional` | 25              |
| `business`     | 999 999         |
| _(unknown)_    | 5 (safe default)|

Mirrored on the frontend in `src/lib/tier-limits.ts` via `getMaxStaffUsers(tier)`
so the UI can pre-flight gate the "Add user" button without a round-trip.

## 2. DB enforcement (last line of defense)

`public.enforce_staff_user_limit()` — `BEFORE INSERT` trigger on
`public.tenant_users`.

1. Bypasses the check for system admins (`is_system_admin(auth.uid())`).
2. Reads `tenants.tier` for `NEW.tenant_id`.
3. Looks up the cap via `get_tier_max_staff_users(v_tier)`.
4. Counts existing rows in `tenant_users` for that tenant.
5. If `count >= max`, raises:

   ```
   Tier "<tier>" allows at most <N> staff user(s). Upgrade your plan to add more.
   ```

This is the canonical error string. **Do not change its shape** without
updating the whitelist regex and the frontend matcher (see §4 and §5).

## 3. Edge function (`admin-users`)

`supabase/functions/admin-users/index.ts`, `action: "create"`:

1. Validates input (email, password, role, etc.).
2. Calls `adminClient.from("tenant_users").insert(...)`.
3. If the trigger raises, the `PostgrestError` bubbles into the outer
   `try/catch` and is handed to `buildErrorResponseBody(error)`.

The dashboard also performs an optimistic pre-flight in
`AdminPanel.createMutation` that re-fetches `tenants.tier` + the user list
on submit and throws the same canonical message if the cap moved (e.g. the
tenant was downgraded mid-session). That keeps the UX consistent without an
extra server round-trip.

## 4. Error sanitization & whitelisting

`supabase/functions/admin-users/sanitize-error.ts`:

- Anything not whitelisted is logged server-side and replaced with
  `GENERIC_ERROR_MESSAGE` to prevent schema/PII leakage.
- Tier-limit messages are explicitly let through by this regex:

  ```ts
  if (/^Tier ".{1,40}" allows at most \d+/.test(msg)) return msg;
  ```

  Sibling whitelists also pass through:
  - `^Your plan allows only \d+ resource\(s\) per type` (resources cap)
  - `/already belongs to another organization/i` (duplicate-tenant trigger)
  - Validator errors starting with `Email|Password|Display name|Role|Invalid…`
  - The hard-coded `SAFE_ERRORS` set (auth/permission/etc.).

`buildErrorResponseBody` then maps the sanitized message to a status via
`statusForSanitized` (tier-limit → **400**) and returns
`{ error: <safe message> }` as JSON. This is the contract the SPA depends on
and is covered by `sanitize-error.test.ts` and `staff-user-limit.test.ts`.

## 5. Frontend mapping → localized toast

1. `src/lib/tier-error-codes.ts` — `parseTierLimitError(message)` matches the
   canonical shape and produces a stable code:

   - `STAFF_USER_LIMIT_REACHED` ← `enforce_staff_user_limit`
   - `SITE_LIMIT_REACHED` ← `enforce_site_limit`
   - `RESOURCE_PER_TYPE_LIMIT_REACHED` ← `enforce_resource_per_type_limit`
   - `RESERVATION_TYPE_LIMIT_REACHED` ← `enforce_reservation_type_limit`

2. `src/hooks/useTierErrorMessage.ts` resolves that code to a localized,
   user-actionable string via `i18n` (EN / FI / SV).

3. `AdminPanel.tsx` decodes the edge-function error (see
   `mem://architecture/error-handling`), runs it through
   `useTierErrorMessage`, and shows a `destructive` toast such as:

   > *Your plan allows up to 5 staff users. Upgrade to add more team members.*

## 6. Tests guarding the contract

- `supabase/functions/admin-users/sanitize-error.test.ts` — proves tier-limit
  and other whitelisted trigger messages survive sanitization verbatim, and
  that unrelated Postgres errors are scrubbed.
- `supabase/functions/admin-users/staff-user-limit.test.ts` — simulates the
  exact `PostgrestError` shape the trigger raises and asserts the full
  response (`status: 400`, body `{ error: "Tier \"basic\" allows at most 5..." }`).
- `src/components/dashboard/AdminPanel.tierLimit.test.tsx` — integration test
  covering both the disabled "Add user" button at the cap and the localized
  toast when the backend rejects the create.

## TL;DR

```
get_tier_max_staff_users(tier)         ← single source of truth for the cap
        │
        ▼
enforce_staff_user_limit (BEFORE INSERT trigger on tenant_users)
        │  raises: 'Tier "<tier>" allows at most <N> staff user(s)…'
        ▼
admin-users edge function  →  sanitize-error.ts (whitelist regex lets it through)
        │                       status 400, body { error: <verbatim message> }
        ▼
AdminPanel  →  parseTierLimitError → STAFF_USER_LIMIT_REACHED
        │
        ▼
useTierErrorMessage  →  localized destructive toast
```

Touching any layer? Update the others — the canonical message string is the
contract that ties them together.
