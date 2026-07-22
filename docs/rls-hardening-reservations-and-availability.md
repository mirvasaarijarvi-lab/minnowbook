# RLS hardening: `reservations` public INSERT & `resource_availability_slots` anon SELECT

This note captures the exact posture of the two policies that were tightened
under the security findings `reservations_public_insert_review` and
`resource_availability_slots_anon_no_tenant_filter`. Keep this file in sync
with the migrations whenever either policy is edited so reviewers (and the
regression tests) share one source of truth.

Regression tests that lock this posture:

- `src/test/security/reservations-anon-staff-only-fields.test.ts`
- `src/test/security/resource-availability-slots-anon-note.test.ts`
- `src/test/security/reservations-anon-discount-malformed.test.ts` (discount subset)

---

## 1. `public.reservations` — "Public can create reservations for active tenants"

**Role:** `PUBLIC` (evaluated for `anon`; authenticated staff go through a
separate `Staff can manage reservations` policy that is unchanged).

**Command:** `INSERT` (policy kind `a` = WITH CHECK only, no USING clause).

**Intent:** the public booking widget must be able to create a *pending*
reservation for an active tenant, but it must NEVER be able to set fields
that only staff/system are allowed to write.

### WITH CHECK clause (verbatim, grouped by intent)

```sql
is_tenant_active(tenant_id)

-- Status must be the default `pending`; other lifecycle flags must be false.
AND NOT (status         IS DISTINCT FROM 'pending')
AND NOT (is_invoiced    IS DISTINCT FROM false)
AND NOT (is_checked_in  IS DISTINCT FROM false)
AND NOT (is_used        IS DISTINCT FROM false)
AND NOT (staff_needed   IS DISTINCT FROM false)

-- Pricing / discounts: staff-only, must be NULL on public insert.
AND price_eur                    IS NULL
AND original_price_eur           IS NULL
AND pricing_details              IS NULL
AND discount_code_id             IS NULL
AND discount_type                IS NULL
AND discount_value               IS NULL
AND discount_reason              IS NULL

-- Free-text notes: staff-only.
AND internal_notes               IS NULL
AND staff_notes                  IS NULL

-- Provenance / mailer bookkeeping: system-only.
AND created_by                   IS NULL
AND acknowledgment_email_sent_at IS NULL
AND confirmation_email_sent_at   IS NULL
AND cancellation_email_sent_at   IS NULL
AND reminder_email_sent_at       IS NULL
```

### Field matrix

| Column                          | Anon INSERT | Rationale                                     |
| ------------------------------- | ----------- | --------------------------------------------- |
| `tenant_id`                     | required    | must resolve to an active tenant              |
| `reservation_type`, `date`, `start_time`, `end_time`, `check_out_date` | allowed | booking payload                     |
| `guest_name`, `guest_email`, `guest_phone`, `guests_count`, `estimated_guests` | allowed | booking payload             |
| `room_type`, `event_type`, `special_requests`, `language` | allowed | booking payload                          |
| `catering_needed`, `accommodation_needed`, `breakfast_included`, `equipment_needed`, `electricity_needed`, `water_needed` | allowed | guest-facing add-ons |
| `dietary_notes`, `delivery_address`, `festival_name`, `stall_size`, `food_permits`, `stall_fee` | allowed | vertical-specific guest fields |
| `restaurant_sub_type`           | allowed     | guest-selected sub type                       |
| `status`                        | must be `pending`         | lifecycle state is staff-owned  |
| `is_invoiced`, `is_checked_in`, `is_used`, `staff_needed` | must be `false` | ops flags                     |
| `price_eur`, `original_price_eur`, `pricing_details` | **must be NULL** | prevents attacker-priced bookings   |
| `discount_code_id`, `discount_type`, `discount_value`, `discount_reason` | **must be NULL** | applied server-side via `claim_discount_code` RPC |
| `staff_notes`, `internal_notes` | **must be NULL**     | staff-only free-text                     |
| `created_by`                    | **must be NULL**     | provenance; would forge audit trail      |
| `acknowledgment_email_sent_at`, `confirmation_email_sent_at`, `cancellation_email_sent_at`, `reminder_email_sent_at` | **must be NULL** | mailer-owned timestamps |

### Safe editing checklist

1. Adding a **new guest-visible field**: no policy change needed, unless you also want the WITH CHECK to constrain its value.
2. Adding a **new staff-only field**: append `AND <new_field> IS NULL` to the WITH CHECK **in the same migration** that adds the column, and add a row to the STAFF_ONLY_CASES matrix in `reservations-anon-staff-only-fields.test.ts`.
3. Never widen `status` to accept anything other than `'pending'` for public inserts — the state machine assumes staff-owned transitions from that point on.
4. Discount fields are triple-scrubbed (policy, defense-in-depth test, edge function). All three must stay aligned.

---

## 2. `public.resource_availability_slots` — anon SELECT via column grants

The hardening here uses **column-level GRANTs** rather than a policy expression,
because the sensitive column (`note`) needs to be hidden even from anon
callers who match the existing `anon read avail slots for active tenants`
policy (`USING (is_tenant_active(tenant_id))`).

### GRANT posture

Table-level `SELECT` is **revoked** from `anon`. It is re-granted only on the
neutral scheduling columns:

| Column         | anon SELECT | Rationale                                      |
| -------------- | ----------- | ---------------------------------------------- |
| `id`           | ✅          | needed for stable references                   |
| `tenant_id`    | ✅          | already the RLS discriminator                  |
| `resource_id`  | ✅          | required to resolve availability to a resource |
| `slot_date`    | ✅          | availability grid                              |
| `start_time`   | ✅          | availability grid                              |
| `end_time`     | ✅          | availability grid                              |
| `created_at`   | ✅          | inert audit metadata                           |
| `updated_at`   | ✅          | inert audit metadata                           |
| `note`         | ❌ **hidden** | internal scheduling context; can contain guest names / staff comments |

`authenticated` and `service_role` retain full table-level SELECT (no change).

### RLS policies (unchanged, listed for completeness)

| Policy                                          | Role          | CMD    | Filter                                                                            |
| ----------------------------------------------- | ------------- | ------ | --------------------------------------------------------------------------------- |
| `anon read avail slots for active tenants`      | `anon`        | SELECT | `is_tenant_active(tenant_id)`                                                     |
| `members read their tenant avail slots`         | `authenticated` | SELECT | `is_user_tenant_member(auth.uid(), tenant_id) OR is_system_admin(auth.uid())`   |
| `members manage avail slots with permission`    | `authenticated` | ALL   | `is_system_admin(auth.uid()) OR has_permission(auth.uid(), 'resources.manage', tenant_id)` |

### Why column grants, not a policy filter

Postgres has no idiomatic way to say "row is visible but this column is not"
inside an RLS expression. The column-privilege system does exactly that:
PostgREST composes the query with `SELECT <allowed_cols>` and rejects any
projection (including `SELECT *`) that touches a column the caller lacks
`SELECT` on. This keeps the RLS policy simple and eliminates the risk of a
forgotten `NULL` scrub in a policy expression.

### Safe editing checklist

1. Adding a **new inert scheduling column** (e.g. `duration_minutes`): add a `GRANT SELECT (<col>) ON public.resource_availability_slots TO anon;` in the same migration.
2. Adding a **new sensitive column**: change nothing on the anon grants — the default `REVOKE` posture already hides it. Add the column to the "hidden columns" section of `resource-availability-slots-anon-note.test.ts` if it should be explicitly regression-locked.
3. Never re-issue `GRANT SELECT ON public.resource_availability_slots TO anon;` at the table level — that undoes the whole fix. If you need to widen access, always name the column list.
4. When renaming a granted column, re-grant the new name in the same migration. Column grants are name-bound and do not follow renames.

---

## Change log

| Date       | Migration                        | Change                                                             |
| ---------- | -------------------------------- | ------------------------------------------------------------------ |
| 2026-07-22 | `reservations_public_insert_review` / `resource_availability_slots_anon_no_tenant_filter` | Introduced WITH CHECK column pin + column-level anon SELECT grants |
