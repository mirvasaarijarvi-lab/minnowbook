
-- Fix 1: Drop anon SELECT on tenants (public access should use tenants_public view)
DROP POLICY IF EXISTS "Public can view active tenants" ON public.tenants;

-- Fix 2: Drop anon SELECT on tenant_settings (public access should use tenant_settings_public view)
DROP POLICY IF EXISTS "Public can view tenant settings for active tenants" ON public.tenant_settings;

-- Fix 3: Drop anon SELECT on site_settings (public access should use site_settings_public view)
DROP POLICY IF EXISTS "Public can view site settings for active tenants" ON public.site_settings;

-- Ensure anon can read the public views instead
-- tenants_public view already exists and is accessible
-- tenant_settings_public view already exists and is accessible  
-- site_settings_public view already exists and is accessible
