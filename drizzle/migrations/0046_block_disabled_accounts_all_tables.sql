DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Active accounts only" ON public.%I', t.relname);
    EXECUTE format(
      'CREATE POLICY "Active accounts only" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.is_account_active(auth.uid()))) WITH CHECK ((SELECT public.is_account_active(auth.uid())))',
      t.relname);
  END LOOP;
END $$;