
-- Function to copy tenant-level opening hours and email templates to a new site
CREATE OR REPLACE FUNCTION public.copy_tenant_defaults_to_site(p_tenant_id uuid, p_site_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Copy opening hours where site_id IS NULL (tenant-level defaults)
  INSERT INTO tenant_opening_hours (tenant_id, site_id, resource_type, day_of_week, open_time, close_time, is_closed, approval_status)
  SELECT tenant_id, p_site_id, resource_type, day_of_week, open_time, close_time, is_closed, 'approved'
  FROM tenant_opening_hours
  WHERE tenant_id = p_tenant_id AND site_id IS NULL;

  -- Copy email templates where site_id IS NULL (tenant-level defaults)
  INSERT INTO tenant_email_templates (tenant_id, site_id, template_type, subject, body_html, language, is_active, approval_status)
  SELECT tenant_id, p_site_id, template_type, subject, body_html, language, is_active, 'approved'
  FROM tenant_email_templates
  WHERE tenant_id = p_tenant_id AND site_id IS NULL;
END;
$$;
