-- Create a daily cron job to resend confirmation emails to unconfirmed users
-- Runs every 6 hours to catch users in their resend windows promptly
SELECT cron.schedule(
  'resend-confirmation-emails',
  '0 */6 * * *',
  $$
  SELECT
    net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/resend-confirmation',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := '{}'::jsonb
    ) AS request_id;
  $$
);