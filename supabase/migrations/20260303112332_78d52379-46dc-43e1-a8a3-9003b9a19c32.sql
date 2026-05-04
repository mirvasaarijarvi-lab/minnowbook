-- Deprecated local seed migration.
-- This previously inserted a test tenant with a hardcoded owner_user_id that
-- does not exist in all environments, causing foreign key failures during reset.
-- Keep this migration as a no-op so migration history remains stable.
SELECT 1;
