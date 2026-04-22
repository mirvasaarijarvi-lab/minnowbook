# RLS Expectations per Tenant-Scoped Table

This document is the **single source of truth** for what the cross-tenant
security suite (`cross-tenant-rls.test.ts`, `tenant-table-manifest.test.ts`)
asserts about every tenant-scoped table in `public`.

When you add or change an RLS policy on any of these tables, update this
file **in the same PR** and re-run:

```bash
bunx vitest run src/test/security/cross-tenant-rls.test.ts
bunx vitest run src/test/security/tenant-table-manifest.test.ts
```

If the tests pass but this doc is stale, the next person to touch the policy
will not know what guarantees they're allowed to weaken. Treat this file as
part of the security contract, not as commentary.

---

## Conventions

For every table below we describe the expected outcome of four operations
in three actor contexts:

| Actor | Definition |
|---|---|
| **anon** | Unauthenticated client (no JWT). |
| **tenant member (own tenant)** | Authenticated user where `is_user_tenant_member(auth.uid(), tenant_id)` is true. |
| **tenant member (foreign tenant)** | Authenticated user where the row's `tenant_id` belongs to *another* tenant. |
| **system admin** | `is_system_admin(auth.uid())` is true. |

Outcomes use this shorthand:

- ✅ **allowed** — the operation succeeds for rows the actor is entitled to.
- ❌ **denied** — RLS returns no rows (SELECT) or raises a `permission denied` /
  `new row violates RLS policy` error (INSERT/UPDATE/DELETE).
- 🔒 **role-gated** — allowed only for `owner` or `admin` within the tenant
  (enforced by `has_tenant_role`).
- 🌐 **public-read carve-out** — anon SELECT is permitted because the table
  feeds the public booking flow; writes are still denied.

The cross-tenant test suite enforces the **❌ denied** column. It does not
care which specific policy denies the access — only that *no path* allows it.

---

## Tables

### `access_code_redemptions`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | ✅ (any tenant member) | ❌ | ✅ |
| INSERT | ❌ | ❌ (only via RPC `redeem_access_code`) | ❌ | ✅ |
| UPDATE | ❌ | ❌ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ |

Notes: redemptions are append-only from the app; staff can read their own
tenant's history, never another tenant's.

---

### `archived_reservations`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | ✅ (any member) | ❌ | ✅ |
| INSERT | ❌ | 🔒 owner/admin | ❌ | ✅ |
| UPDATE | ❌ | 🔒 owner/admin | ❌ | ✅ |
| DELETE | ❌ | 🔒 owner/admin | ❌ | ✅ |

---

### `audit_log`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | 🔒 owner/admin only | ❌ | ✅ |
| INSERT | ❌ | ❌ (DB trigger writes only) | ❌ | ❌ (trigger only) |
| UPDATE | ❌ | ❌ | ❌ | ❌ |
| DELETE | ❌ | ❌ | ❌ | ❌ |

Notes: writes happen exclusively through `audit_log_trigger()` (SECURITY
DEFINER). No policy permits direct INSERT/UPDATE/DELETE — the test suite
verifies this stays true.

---

### `beta_feedback`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | ✅ own row only (`user_id = auth.uid()`) | ❌ | ✅ |
| INSERT | ❌ | ✅ own `user_id` + own tenant | ❌ | ✅ |
| UPDATE | ❌ | ❌ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ |

---

### `blocked_slots`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | 🌐 active tenants only | ✅ | ❌ | ✅ |
| INSERT | ❌ | 🔒 owner/admin | ❌ | ✅ |
| UPDATE | ❌ | 🔒 owner/admin | ❌ | ✅ |
| DELETE | ❌ | 🔒 owner/admin | ❌ | ✅ |

Notes: anon SELECT is intentional — the public booking calendar must show
unavailable slots. Writes are strictly role-gated and tenant-scoped.

---

### `booking_tokens`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | 🔒 owner/admin | ❌ | ✅ |
| INSERT | ❌ | ✅ any member | ❌ | ✅ |
| UPDATE | ❌ | 🔒 owner/admin | ❌ | ✅ |
| DELETE | ❌ | 🔒 owner/admin | ❌ | ✅ |

Notes: token *value* matching by anon happens via `lookup_booking_token`
RPC (SECURITY DEFINER), not direct SELECT.

---

### `booking_validation_log`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | 🔒 owner/admin | ❌ | ✅ |
| INSERT | ❌ | ✅ any member | ❌ | ✅ |
| UPDATE | ❌ | ❌ | ❌ | ✅ |
| DELETE | ❌ | 🔒 owner/admin | ❌ | ✅ |

---

### `discount_codes`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | ✅ any member | ❌ | ✅ |
| INSERT | ❌ | 🔒 owner/admin | ❌ | ✅ |
| UPDATE | ❌ | 🔒 owner/admin | ❌ | ✅ |
| DELETE | ❌ | 🔒 owner/admin | ❌ | ✅ |

---

### `email_send_log`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | 🔒 owner/admin | ❌ | ✅ |
| INSERT | ❌ | ❌ (service role only) | ❌ | ❌ (service role only) |
| UPDATE | ❌ | ❌ | ❌ | ❌ |
| DELETE | ❌ | ❌ | ❌ | ❌ |

Notes: writes happen exclusively from edge functions via the service role.
A restrictive policy explicitly blocks anon and non-admin authenticated
mutations.

---

### `guest_reviews`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ direct (use `get_published_reviews` RPC) | 🔒 owner/admin | ❌ | ✅ |
| INSERT | ✅ with valid `review_token` | 🔒 owner/admin | ❌ | ✅ |
| UPDATE | ❌ | 🔒 owner/admin | ❌ | ✅ |
| DELETE | ❌ | 🔒 owner/admin | ❌ | ✅ |

Notes: anon INSERT is gated by `is_valid_review_token_for_reservation` —
the token binds the row to one specific reservation in one tenant.

---

### `kitchen_menu_items`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | ✅ any member | ❌ | ✅ |
| INSERT | ❌ | ✅ any member | ❌ | ✅ |
| UPDATE | ❌ | ✅ any member | ❌ | ✅ |
| DELETE | ❌ | ✅ any member | ❌ | ✅ |

---

### `kitchen_orders`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | ✅ any member | ❌ | ✅ |
| INSERT | ❌ | ✅ any member | ❌ | ✅ |
| UPDATE | ❌ | ✅ any member | ❌ | ✅ |
| DELETE | ❌ | ✅ any member | ❌ | ✅ |

---

### `login_history`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | ✅ own row, 🔒 owner/admin for tenant | ❌ | ✅ |
| INSERT | ❌ | ✅ own `user_id` + own tenant | ❌ | ✅ |
| UPDATE | ❌ | ❌ | ❌ | ❌ |
| DELETE | ❌ | ❌ | ❌ | ❌ |

---

### `notifications`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | ✅ any member | ❌ | ✅ |
| INSERT | ❌ | ✅ any member | ❌ | ✅ |
| UPDATE | ❌ | ✅ any member | ❌ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ |

---

### `offers`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | ✅ any member | ❌ | ✅ |
| INSERT | ❌ | 🔒 owner/admin | ❌ | ✅ |
| UPDATE | ❌ | 🔒 owner/admin | ❌ | ✅ |
| DELETE | ❌ | 🔒 owner/admin | ❌ | ✅ |

---

### `recurring_blocked_slots`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | 🌐 active tenants only | ✅ | ❌ | ✅ |
| INSERT | ❌ | 🔒 owner/admin | ❌ | ✅ |
| UPDATE | ❌ | 🔒 owner/admin | ❌ | ✅ |
| DELETE | ❌ | 🔒 owner/admin | ❌ | ✅ |

---

### `reservations`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | ✅ any member | ❌ | ✅ |
| INSERT | ✅ if tenant `is_active = true` | ✅ any member | ❌ | ✅ |
| UPDATE | ❌ | ✅ any member | ❌ | ✅ |
| DELETE | ❌ | ✅ any member | ❌ | ✅ |

Notes: anon INSERT supports the public booking flow. The `WITH CHECK`
clause forces `tenant_id` to belong to an active tenant; cross-tenant
writes are still denied.

---

### `resource_images`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ✅ public | ✅ | ❌ direct rows of other tenants are filtered | ✅ |
| INSERT | ❌ | 🔒 owner/admin | ❌ | ✅ |
| UPDATE | ❌ | 🔒 owner/admin | ❌ | ✅ |
| DELETE | ❌ | 🔒 owner/admin | ❌ | ✅ |

Notes: SELECT is intentionally world-readable (image URLs are non-secret
and the public booking flow renders them). Cross-tenant writes are denied.

---

### `resource_opening_hours`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | 🌐 active tenants only | ✅ | ❌ | ✅ |
| INSERT | ❌ | 🔒 owner/admin | ❌ | ✅ |
| UPDATE | ❌ | 🔒 owner/admin | ❌ | ✅ |
| DELETE | ❌ | 🔒 owner/admin | ❌ | ✅ |

---

### `resources`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | 🌐 `is_active AND approval_status='approved'` only | ✅ any member | ❌ | ✅ |
| INSERT | ❌ | 🔒 owner/admin | ❌ | ✅ |
| UPDATE | ❌ | 🔒 owner/admin | ❌ | ✅ |
| DELETE | ❌ | 🔒 owner/admin | ❌ | ✅ |

---

### `role_definitions` / `role_permissions`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | ✅ any member | ❌ | ✅ |
| INSERT | ❌ | 🔒 owner/admin | ❌ | ✅ |
| UPDATE | ❌ | 🔒 owner/admin | ❌ | ✅ |
| DELETE | ❌ | 🔒 owner/admin (system roles protected) | ❌ | ✅ |

Notes: rows where `is_system = true` are protected from deletion at the
policy level so tenants can't accidentally remove `owner`/`admin`/`staff`.

---

### `site_settings` / `tenant_settings`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ direct | ✅ any member | ❌ | ✅ |
| INSERT | ❌ | 🔒 owner/admin | ❌ | ✅ |
| UPDATE | ❌ | 🔒 owner/admin | ❌ | ✅ |
| DELETE | ❌ | ❌ (settings are upserted, not deleted) | ❌ | ✅ |

Notes: a public-safe projection of branding fields is exposed via the
`tenants_public` view; raw settings rows are never anon-readable.

---

### `site_users` / `tenant_users`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | ✅ any member (own tenant only) | ❌ | ✅ |
| INSERT | ❌ | 🔒 owner/admin | ❌ | ✅ |
| UPDATE | ❌ | 🔒 owner/admin | ❌ | ✅ |
| DELETE | ❌ | 🔒 owner/admin (cannot remove last owner) | ❌ | ✅ |

Notes: tier-based caps on member count are enforced by the
`enforce_staff_user_limit` trigger, not by RLS.

---

### `sites`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | 🌐 active sites only | ✅ any member | ❌ | ✅ |
| INSERT | ❌ | 🔒 owner/admin | ❌ | ✅ |
| UPDATE | ❌ | 🔒 owner/admin | ❌ | ✅ |
| DELETE | ❌ | 🔒 owner/admin | ❌ | ✅ |

---

### `support_requests`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ | ✅ any member | ❌ | ✅ |
| INSERT | ❌ | ✅ any member | ❌ | ✅ |
| UPDATE | ❌ | 🔒 owner/admin | ❌ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ✅ |

---

### `tenant_email_templates` / `tenant_opening_hours`

| Op | anon | own tenant | foreign tenant | system admin |
|---|---|---|---|---|
| SELECT | ❌ direct | ✅ any member | ❌ | ✅ |
| INSERT | ❌ | 🔒 owner/admin | ❌ | ✅ |
| UPDATE | ❌ | 🔒 owner/admin | ❌ | ✅ |
| DELETE | ❌ | 🔒 owner/admin | ❌ | ✅ |

Notes: opening hours are also surfaced anonymously through the public
booking RPC, never through direct SELECT.

---

## Excluded tables

The manifest test (`tenant-table-manifest.test.ts`) tracks an explicit
exclusion list. Currently the only excluded table is:

| Table | Reason |
|---|---|
| `waitlist` | Public marketing signup. Insert-only from anon, read-only by service role. No tenant-private data ever lands here. |

If you add a tenant-scoped table, add it to `COVERED_TABLES` in the
manifest test and append a row to the matrix above. If you intentionally
want a table excluded from cross-tenant sweeps, add it to `EXCLUDED_TABLES`
with a one-line justification.

---

## Updating this document

When you change a policy:

1. Update the relevant table's row above. If the change tightens
   (more denials), the cross-tenant test suite should still pass.
2. If the change loosens (e.g., new anon read carve-out), ensure the
   public booking / marketing requirement is documented in the **Notes**
   block under that table.
3. Run the security suites locally and in CI:

   ```bash
   bunx vitest run src/test/security/cross-tenant-rls.test.ts
   bunx vitest run src/test/security/tenant-table-manifest.test.ts
   ```

4. If a new table is added, update both `COVERED_TABLES` and the matrix.

The `RlsManifestDebugPanel` in the Superadmin dashboard can verify in
real time that this matrix and the live schema are still in sync.
