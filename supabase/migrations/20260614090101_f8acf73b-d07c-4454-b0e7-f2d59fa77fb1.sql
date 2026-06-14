-- Guarded re-seed of the example "Serenity Wellness Studio" tenant.
-- Skips on databases where the owner user is missing (e.g. fresh CI stacks
-- without seeded auth.users) and where the tenant already exists.
DO $$
DECLARE
  v_owner uuid := '3cbff9d9-15ea-48fb-ae01-9c30faf3c3fa';
  v_tenant uuid;
  v_site uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_owner) THEN
    RAISE NOTICE 'Owner user % not present, skipping wellness seed.', v_owner;
    RETURN;
  END IF;

  SELECT id INTO v_tenant FROM public.tenants WHERE slug = 'serenity-wellness';
  IF v_tenant IS NOT NULL THEN
    RAISE NOTICE 'Tenant serenity-wellness already exists (%), skipping.', v_tenant;
    RETURN;
  END IF;

  INSERT INTO public.tenants (name, slug, owner_user_id, allowed_reservation_types, tier, is_active, subscription_status)
  VALUES ('Serenity Wellness Studio', 'serenity-wellness', v_owner, ARRAY['wellness']::text[], 'professional', true, 'active')
  RETURNING id INTO v_tenant;

  INSERT INTO public.tenant_users (tenant_id, user_id, role, is_approved, display_name)
  VALUES (v_tenant, v_owner, 'owner', true, 'Studio Owner');

  INSERT INTO public.tenant_settings (
    tenant_id, business_name, business_email, business_phone, business_address,
    business_description, primary_color, default_language, timezone
  ) VALUES (
    v_tenant, 'Serenity Wellness Studio',
    'hello@serenity-wellness.example', '+358 40 123 4567',
    'Aleksanterinkatu 12, 00100 Helsinki',
    'Boutique wellness studio offering physiotherapy and therapeutic massage. Walk-ins welcome by appointment.',
    '#2f6f5e', 'en', 'Europe/Helsinki'
  );

  INSERT INTO public.sites (tenant_id, name, slug, location, description, is_active)
  VALUES (v_tenant, 'Helsinki Studio', 'helsinki', 'Aleksanterinkatu 12, Helsinki', 'Main studio location', true)
  RETURNING id INTO v_site;

  INSERT INTO public.resources (tenant_id, site_id, name, resource_type, description, capacity, is_active, sub_services)
  VALUES
    (v_tenant, v_site, 'Physiotherapy with Anna', 'wellness',
     'Licensed physiotherapist. Assessment, manual therapy and rehabilitation programs.',
     1, true,
     jsonb_build_array(
       jsonb_build_object('id', gen_random_uuid(), 'name', 'Initial assessment (60 min)', 'price_eur', 75, 'duration_min', 60),
       jsonb_build_object('id', gen_random_uuid(), 'name', 'Follow-up session (45 min)', 'price_eur', 60, 'duration_min', 45),
       jsonb_build_object('id', gen_random_uuid(), 'name', 'Manual therapy (45 min)', 'price_eur', 65, 'duration_min', 45),
       jsonb_build_object('id', gen_random_uuid(), 'name', 'Sports injury rehab (60 min)', 'price_eur', 80, 'duration_min', 60),
       jsonb_build_object('id', gen_random_uuid(), 'name', 'Posture review (30 min)', 'price_eur', 45, 'duration_min', 30),
       jsonb_build_object('id', gen_random_uuid(), 'name', 'Dry needling (30 min)', 'price_eur', 55, 'duration_min', 30)
     )),
    (v_tenant, v_site, 'Massage with Marko', 'wellness',
     'Certified massage therapist. Relaxation, deep tissue and sports massage.',
     1, true,
     jsonb_build_array(
       jsonb_build_object('id', gen_random_uuid(), 'name', 'Classic massage (30 min)', 'price_eur', 45, 'duration_min', 30),
       jsonb_build_object('id', gen_random_uuid(), 'name', 'Classic massage (60 min)', 'price_eur', 75, 'duration_min', 60),
       jsonb_build_object('id', gen_random_uuid(), 'name', 'Classic massage (90 min)', 'price_eur', 105, 'duration_min', 90),
       jsonb_build_object('id', gen_random_uuid(), 'name', 'Deep tissue (60 min)', 'price_eur', 85, 'duration_min', 60),
       jsonb_build_object('id', gen_random_uuid(), 'name', 'Sports massage (60 min)', 'price_eur', 85, 'duration_min', 60),
       jsonb_build_object('id', gen_random_uuid(), 'name', 'Hot stone (75 min)', 'price_eur', 95, 'duration_min', 75),
       jsonb_build_object('id', gen_random_uuid(), 'name', 'Aromatherapy (60 min)', 'price_eur', 80, 'duration_min', 60),
       jsonb_build_object('id', gen_random_uuid(), 'name', 'Pregnancy massage (60 min)', 'price_eur', 80, 'duration_min', 60)
     ));
END $$;