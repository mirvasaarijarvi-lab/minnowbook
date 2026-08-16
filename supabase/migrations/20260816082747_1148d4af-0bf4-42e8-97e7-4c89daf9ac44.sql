DO $$
BEGIN
  PERFORM cron.unschedule('daily-ops-digest-0400-utc');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'daily-ops-digest-0400-utc',
  '0 4 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://lsgznskkxadplwnxplhd.supabase.co/functions/v1/daily-ops-digest',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', concat('Bearer ', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1))
      ),
      body:='{}'::jsonb
    ) AS request_id;
  $$
);