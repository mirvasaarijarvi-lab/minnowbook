
-- 1) Remove tenant_users from Realtime publication to prevent broadcast of
--    role changes / profile fields to other tenant members.
ALTER PUBLICATION supabase_realtime DROP TABLE public.tenant_users;

-- 2) booking_validation_log hardening:
--    - Restrict allowed `source` values to a fixed set (no arbitrary text)
--    - Cap guest_name/guest_email length to limit PII payload size
ALTER TABLE public.booking_validation_log
  ADD CONSTRAINT booking_validation_log_source_check
  CHECK (source IN ('manual_dashboard','public_booking','edit_dialog','public_booking_edge')),
  ADD CONSTRAINT booking_validation_log_guest_name_len
  CHECK (guest_name IS NULL OR char_length(guest_name) <= 200),
  ADD CONSTRAINT booking_validation_log_guest_email_len
  CHECK (guest_email IS NULL OR char_length(guest_email) <= 320);

-- 3) audit_log: make the "no direct writes" intent explicit so security
--    scanners stop flagging the missing INSERT policy. Service role bypasses
--    RLS and continues to write from edge functions; database triggers (if
--    later added) would also bypass via SECURITY DEFINER.
CREATE POLICY "Block direct inserts to audit_log"
  ON public.audit_log AS RESTRICTIVE FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "Block direct updates to audit_log"
  ON public.audit_log AS RESTRICTIVE FOR UPDATE
  TO anon, authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Block direct deletes from audit_log"
  ON public.audit_log AS RESTRICTIVE FOR DELETE
  TO anon, authenticated
  USING (false);

COMMENT ON TABLE public.audit_log IS
  'Append-only audit trail. Writes are performed exclusively by service_role from edge functions (which bypass RLS). Direct API writes from anon/authenticated are blocked by RESTRICTIVE policies.';

COMMENT ON TABLE public.booking_validation_log IS
  'Booking validation outcomes. INSERT is allowed for authenticated tenant members so dashboard validation flows can record outcomes; CHECK constraints restrict the `source` field to a fixed enum and cap PII column length to limit injection of unrelated guest data.';
