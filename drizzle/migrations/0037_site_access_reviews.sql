CREATE TABLE public.site_access_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_by uuid NOT NULL DEFAULT auth.uid(),
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX site_access_reviews_site_idx ON public.site_access_reviews(tenant_id, site_id, accepted_at DESC);

CREATE TABLE public.site_access_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  subject_kind text NOT NULL CHECK (subject_kind IN ('user','staff')),
  subject_id uuid NOT NULL,
  subject_name text NOT NULL DEFAULT '',
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','dismissed')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid,
  resolved_at timestamptz
);
CREATE INDEX site_access_change_requests_site_idx ON public.site_access_change_requests(tenant_id, site_id, status);

GRANT SELECT, INSERT ON public.site_access_reviews TO authenticated;
GRANT ALL ON public.site_access_reviews TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.site_access_change_requests TO authenticated;
GRANT ALL ON public.site_access_change_requests TO service_role;

ALTER TABLE public.site_access_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_access_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers read access reviews" ON public.site_access_reviews FOR SELECT TO authenticated
  USING (public.is_tenant_manager(auth.uid(), tenant_id) OR public.is_system_admin(auth.uid()));
CREATE POLICY "Managers accept access reviews" ON public.site_access_reviews FOR INSERT TO authenticated
  WITH CHECK ((public.is_tenant_manager(auth.uid(), tenant_id) OR public.is_system_admin(auth.uid()))
    AND accepted_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND s.tenant_id = site_access_reviews.tenant_id)
    AND NOT EXISTS (SELECT 1 FROM public.site_access_change_requests r
      WHERE r.site_id = site_access_reviews.site_id AND r.tenant_id = site_access_reviews.tenant_id AND r.status = 'open'));

CREATE POLICY "Managers read change requests" ON public.site_access_change_requests FOR SELECT TO authenticated
  USING (public.is_tenant_manager(auth.uid(), tenant_id) OR public.is_system_admin(auth.uid()));
CREATE POLICY "Managers add change requests" ON public.site_access_change_requests FOR INSERT TO authenticated
  WITH CHECK ((public.is_tenant_manager(auth.uid(), tenant_id) OR public.is_system_admin(auth.uid()))
    AND created_by = auth.uid() AND status = 'open'
    AND EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_id AND s.tenant_id = site_access_change_requests.tenant_id));
CREATE POLICY "Managers resolve change requests" ON public.site_access_change_requests FOR UPDATE TO authenticated
  USING (public.is_tenant_manager(auth.uid(), tenant_id) OR public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_tenant_manager(auth.uid(), tenant_id) OR public.is_system_admin(auth.uid()));