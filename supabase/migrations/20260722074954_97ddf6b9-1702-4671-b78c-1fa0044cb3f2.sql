DROP POLICY IF EXISTS "Public can view resource images" ON public.resource_images;

CREATE POLICY "Public can view resource images"
ON public.resource_images
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.resources r
    WHERE r.id = resource_images.resource_id
      AND r.is_active = true
      AND r.approval_status = 'approved'
  )
);