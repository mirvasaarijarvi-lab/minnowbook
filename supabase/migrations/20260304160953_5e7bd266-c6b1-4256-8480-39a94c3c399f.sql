SELECT cron.schedule(
  'send-auto-reminders-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
        url:='https://lsgznskkxadplwnxplhd.supabase.co/functions/v1/send-auto-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzZ3puc2treGFkcGx3bnhwbGhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MTkyODAsImV4cCI6MjA4NzQ5NTI4MH0.v6DlzrUsFu_fpTIcWcSzz1Zyqbl_ZwF9v54TrW_yWtM"}'::jsonb,
        body:='{}'::jsonb
    ) AS request_id;
  $$
);