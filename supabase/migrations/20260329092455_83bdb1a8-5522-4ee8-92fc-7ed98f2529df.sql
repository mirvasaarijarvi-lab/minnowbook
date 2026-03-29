CREATE OR REPLACE FUNCTION public.get_unconfirmed_users(since_date timestamptz)
RETURNS TABLE(id uuid, email text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT au.id, au.email::text, au.created_at
  FROM auth.users au
  WHERE au.email_confirmed_at IS NULL
    AND au.email IS NOT NULL
    AND au.created_at >= since_date
  ORDER BY au.created_at ASC;
$$;