-- Enable realtime broadcasts on tenant_users so the client can react when
-- a user's membership is removed mid-session.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tenant_users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_users;
  END IF;
END $$;

ALTER TABLE public.tenant_users REPLICA IDENTITY FULL;