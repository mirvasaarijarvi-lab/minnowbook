-- Keep the existing cleanup command and dashboard enable/disable behavior.
-- Only reduce an already-disabled cleanup job, never an enabled one.
SELECT cron.alter_job(jobid, schedule := '15 3 * * 0')
FROM cron.job
WHERE jobname = 'test-reservation-cleanup-daily'
  AND NOT COALESCE((
    SELECT is_enabled
    FROM public.test_reservation_cleanup_config
    ORDER BY updated_at DESC
    LIMIT 1
  ), false);