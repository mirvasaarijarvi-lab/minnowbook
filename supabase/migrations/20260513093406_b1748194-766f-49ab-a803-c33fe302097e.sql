-- Clean up test reservation backlog: keep only the 20 most recent test
-- reservations (TEST% guest_name or @example.com email), preserving any
-- linked cross-booking siblings. Real (non-test) reservations are untouched.
WITH test_rows AS (
  SELECT id, created_at, linked_group_id,
         ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
  FROM public.reservations
  WHERE guest_name ILIKE 'TEST%' OR guest_email ILIKE '%@example.com'
),
keep_ids AS (
  SELECT id FROM test_rows WHERE rn <= 20
  UNION
  -- Keep any sibling sharing a linked_group_id with a kept row, so groups
  -- stay intact even if the cutoff would have split them.
  SELECT t.id
  FROM test_rows t
  JOIN test_rows k ON k.linked_group_id = t.linked_group_id
  WHERE k.rn <= 20 AND t.linked_group_id IS NOT NULL
),
to_delete AS (
  SELECT id FROM public.reservations
  WHERE (guest_name ILIKE 'TEST%' OR guest_email ILIKE '%@example.com')
    AND id NOT IN (SELECT id FROM keep_ids)
)
DELETE FROM public.reservations WHERE id IN (SELECT id FROM to_delete);
