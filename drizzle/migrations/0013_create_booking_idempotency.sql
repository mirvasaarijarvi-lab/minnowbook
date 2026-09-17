-- Explicit idempotency keys for public booking create requests.
-- A client may send the same key when retrying a create; the key maps to the
-- one reservation that request produced, so promotions are claimed once only.
CREATE TABLE public.booking_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  reservation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT booking_idempotency_key_len CHECK (char_length(idempotency_key) BETWEEN 8 AND 200)
);

CREATE UNIQUE INDEX booking_idempotency_tenant_key_uidx
  ON public.booking_idempotency (tenant_id, idempotency_key);

-- Edge functions use the service role; guests and staff never read this table.
GRANT ALL ON public.booking_idempotency TO service_role;

ALTER TABLE public.booking_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System admins can view booking idempotency records"
  ON public.booking_idempotency
  FOR SELECT
  TO authenticated
  USING (public.is_system_admin(auth.uid()));