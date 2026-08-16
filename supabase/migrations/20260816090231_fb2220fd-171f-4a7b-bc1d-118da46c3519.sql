select cron.schedule(
  'weekly-ops-report-hourly',
  '10 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://lsgznskkxadplwnxplhd.supabase.co/functions/v1/weekly-ops-report',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', concat('Bearer ', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1))
      ),
      body:='{}'::jsonb
    ) AS request_id;
  $$
);