
-- Remove the old cron job with hardcoded anon key
SELECT cron.unschedule('send-auto-reminders-hourly');

-- Recreate cron job using service role key from vault
SELECT cron.schedule(
  'send-auto-reminders-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://lsgznskkxadplwnxplhd.supabase.co/functions/v1/send-auto-reminders',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', concat('Bearer ', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1))
        ),
        body:='{}'::jsonb
    ) AS request_id;
  $$
);
