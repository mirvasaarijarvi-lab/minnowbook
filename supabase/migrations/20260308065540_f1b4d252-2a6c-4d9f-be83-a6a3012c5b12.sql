
-- Notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'reservation_used', 'reservation_invoiced'
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- All tenant members can view notifications
CREATE POLICY "Tenant members can view notifications"
  ON public.notifications FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- All tenant members can update (mark as read)
CREATE POLICY "Tenant members can update notifications"
  ON public.notifications FOR UPDATE
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- System admins full access
CREATE POLICY "System admins can manage all notifications"
  ON public.notifications FOR ALL
  USING (is_system_admin(auth.uid()))
  WITH CHECK (is_system_admin(auth.uid()));

-- Service role inserts via trigger, so no INSERT policy needed for users

-- Trigger function to create notifications on is_used or is_invoiced change
CREATE OR REPLACE FUNCTION public.notify_reservation_status_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- When is_used changes to true
  IF (OLD.is_used IS DISTINCT FROM NEW.is_used) AND NEW.is_used = true THEN
    INSERT INTO public.notifications (tenant_id, reservation_id, type, title, message)
    VALUES (
      NEW.tenant_id,
      NEW.id,
      'reservation_used',
      'Reservation marked as used',
      NEW.guest_name || ' (' || NEW.reservation_type || ' on ' || NEW.date || ') has been marked as used.'
    );
  END IF;

  -- When is_invoiced changes to true
  IF (OLD.is_invoiced IS DISTINCT FROM NEW.is_invoiced) AND NEW.is_invoiced = true THEN
    INSERT INTO public.notifications (tenant_id, reservation_id, type, title, message)
    VALUES (
      NEW.tenant_id,
      NEW.id,
      'reservation_invoiced',
      'Reservation marked as invoiced',
      NEW.guest_name || ' (' || NEW.reservation_type || ' on ' || NEW.date || ') has been marked as invoiced.'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_reservation_status
  AFTER UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_reservation_status_change();
