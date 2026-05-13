-- Backfill linked_group_id on reservations that belong to a legacy multi-leg
-- offer but were created before the linked_group_id column existed (or were
-- imported from the old system without it). For each such offer we pick an
-- existing group id from any leg that already has one, falling back to a
-- freshly generated uuid, and apply it to every leg that is still NULL.
--
-- Idempotent: rows that already carry the chosen group id are not touched.
-- Safe to re-run.

WITH multi_offers AS (
  SELECT
    o.id            AS offer_id,
    o.tenant_id,
    o.reservation_ids
  FROM public.offers o
  WHERE o.reservation_ids IS NOT NULL
    AND array_length(o.reservation_ids, 1) >= 2
),
-- Resolve a single canonical group id per offer: reuse the first non-null
-- linked_group_id we find on any leg, otherwise mint a new one. Doing this
-- in a CTE guarantees every leg of the same offer gets the SAME id.
offer_group AS (
  SELECT
    mo.offer_id,
    mo.tenant_id,
    mo.reservation_ids,
    COALESCE(
      (
        SELECT r.linked_group_id
        FROM public.reservations r
        WHERE r.id = ANY(mo.reservation_ids)
          AND r.tenant_id = mo.tenant_id
          AND r.linked_group_id IS NOT NULL
        LIMIT 1
      ),
      gen_random_uuid()
    ) AS group_id
  FROM multi_offers mo
)
UPDATE public.reservations r
SET linked_group_id = og.group_id,
    updated_at = now()
FROM offer_group og
WHERE r.tenant_id = og.tenant_id
  AND r.id = ANY(og.reservation_ids)
  AND r.linked_group_id IS DISTINCT FROM og.group_id;