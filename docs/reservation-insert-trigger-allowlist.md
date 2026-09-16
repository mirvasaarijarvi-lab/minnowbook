# Reservation insert triggers: service_role allowlist and pricing sanitisation

Two BEFORE triggers guard `public.reservations`. They run in name order:

1. `trg_validate_public_reservation_insert` (BEFORE INSERT) to
   `validate_public_reservation_insert()` — decides trust and scrubs untrusted input.
2. `trg_zz_sanitize_reservation_pricing` (BEFORE INSERT OR UPDATE) to
   `sanitize_reservation_pricing()` — normalises malformed pricing/discount payloads in
   every context, trusted included.

## 1. Trust decision

`validate_public_reservation_insert()` classifies the caller:

| Caller | Behaviour |
| --- | --- |
| Authenticated user (`auth.uid()` not null) | Returns immediately; RLS policies are the only gate. |
| Trusted server: JWT role `service_role`, or `current_user` in (`service_role`, `supabase_admin`, `postgres`) | `v_trusted := true`. Pricing, discount, staff and email-timestamp columns are kept as sent. Guest name/email/phone are still trimmed and lowercased, but not length/format validated. |
| Anonymous (public booking form) | Fully scrubbed, plus guest-field validation and a no-past-dates rule. |

The trusted path exists because `supabase/functions/public-booking` computes canonical
pricing server-side (`supabase/functions/_shared/reservation-pricing.ts`). Without the
allowlist the trigger would null out prices the server just calculated.

### Fields nulled/forced for untrusted inserts

- Status flags: `status='pending'`, `is_invoiced`, `is_checked_in`, `is_used`, `staff_needed` to `false`.
- Pricing: `price_eur`, `original_price_eur`, `pricing_details`.
- Discount: `discount_code_id`, `discount_type`, `discount_value`, `discount_reason`.
- Staff/system: `internal_notes`, `staff_notes`, `created_by`.
- Email timestamps: `acknowledgment_`, `confirmation_`, `cancellation_`, `reminder_email_sent_at`.

Anything not in that list is guest-supplied and passes through for every caller.

## 2. Pricing sanitisation (applies to trusted callers too)

`sanitize_reservation_pricing()` is defence in depth: service_role is trusted, but a bug
in a server-side caller must not be able to persist nonsense money. It:

- Nulls non-finite numerics (`NaN`, `+/-Infinity`) in `price_eur`, `original_price_eur`,
  `discount_value`, `stall_fee`. These pass the `>= 0` CHECK constraints, so the
  constraints alone are not enough.
- Detaches `discount_code_id` when the code is missing or owned by another tenant.
- Clears the whole discount payload (`discount_type`, `discount_value`,
  `discount_code_id`, `discount_reason`) when it is incomplete or inconsistent:
  type without value, value without type, value `<= 0`, percentage over 100, or a fixed
  amount larger than `original_price_eur`. When that happens and a gross amount exists,
  `price_eur` is reset to `original_price_eur`, so the guest owes the full price rather
  than a number derived from the bad payload.
- Raises `original_price_eur` to `price_eur` if gross was below the final amount.

Hard rejections stay in CHECK constraints: negative money, unknown `discount_type`,
unknown `status`, unknown `reservation_type`.

## 3. Adding a new pricing or staff-owned field

1. Add the column with a CHECK constraint for the values that are always invalid
   (non-negative money, enum membership). Constraints run after the triggers.
2. Add it to the untrusted scrub block in `validate_public_reservation_insert()` if it is
   staff- or server-owned. If a guest may legitimately send it, leave it out and validate
   it in the untrusted branch instead. Getting this wrong is a privilege issue: an
   unlisted server-owned column can be set by anonymous booking traffic.
3. If it is money, add the non-finite guard in `sanitize_reservation_pricing()`, and
   extend the consistency rules if it participates in the discount maths.
4. Have the public booking function set it from server-side computation, never from the
   request body.
5. Extend the regression tests:
   - `src/test/security/reservations-anon-discount-malformed.test.ts` and
     `reservations-anon-staff-only-fields.test.ts` for the anonymous scrub.
   - `src/test/security/reservations-service-role-pricing-allowlist.test.ts` for the
     trusted pass-through.
   - `src/test/security/reservations-malformed-discount-payloads.test.ts` for malformed
     payloads sent as service_role.
6. Register any new spec in `vitest.security-live.files.ts` or it will not run in CI.

Run locally with a service role key present:

```bash
bunx vitest run --config vitest.security-live.config.ts \
  src/test/security/reservations-malformed-discount-payloads.test.ts \
  src/test/security/reservations-service-role-pricing-allowlist.test.ts \
  src/test/security/reservations-anon-discount-malformed.test.ts
```

## 4. Audit trail

`validate_public_reservation_insert()` calls `log_reservation_pricing_decision()`
(SECURITY DEFINER) and writes one `public.audit_log` row per insert with
`table_name='reservations'`, `action='pricing_trust_decision'`,
`record_id = NEW.id` and `new_data`:

```json
{
  "trusted": true,
  "jwt_role": "service_role",
  "db_user": "authenticator",
  "kept_fields": ["price_eur", "original_price_eur", "discount_type"],
  "scrubbed_fields": [],
  "submitted_values": { "price_eur": 90, "original_price_eur": 120 }
}
```

Trusted inserts are always logged. Untrusted inserts are logged only when the
payload actually carried pricing/discount fields, so an ordinary public booking
adds no row. Logging failures are swallowed and never block a booking, and a
rolled-back insert leaves no entry. When you add a field in step 3, add it to
the `v_supplied` snapshot block so it shows up in `kept_fields` /
`scrubbed_fields`. Retention follows `cleanup_old_audit_logs()` (90 days).
Coverage: `src/test/security/reservations-pricing-trust-audit.test.ts`.

Related: `docs/rls-hardening-reservations-and-availability.md`.
