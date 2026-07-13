# Supabase Key Rotation Schedule

Lovable Cloud does not expose an unattended API for rotating the Supabase
anon / publishable key, and the key is baked into the Vite bundle at build
time. Rotation therefore has to be initiated manually and followed by a
republish. Use this file as the source of truth for when to do that.

## How to rotate

1. Ask the Lovable agent: **"Rotate the Supabase anon key."**
   The agent calls the `supabase--rotate_api_keys` tool, which mints new
   keys, updates the integration data, and rewrites `.env`
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `VITE_SUPABASE_PROJECT_ID`).
2. Republish the app so the new key ships in the bundle:
   `<presentation-actions><presentation-open-publish>Publish</presentation-open-publish></presentation-actions>`
3. Verify the site loads and Supabase requests succeed (Network tab, no
   401s from `*.supabase.co`).
4. Update the **Last rotated** / **Next rotation due** rows below.
5. If the previous key was believed to be exposed (public repo, leaked
   log, scanner finding), also mark the corresponding security finding
   as resolved in Project Monitoring.

## Cadence

Routine rotation every **90 days**. Rotate immediately, out of cycle,
whenever any of these happen:

- A scanner or reviewer flags the anon key as leaked (e.g. hardcoded in
  a workflow file, printed in a log, committed to a public repo).
- A workspace member with production access leaves.
- Suspicious traffic patterns against `*.supabase.co` from unknown
  origins.

## Log

| Date (UTC) | Reason              | Rotated by | Republished |
| ---------- | ------------------- | ---------- | ----------- |
| 2026-07-13 | Initial baseline    |     ,        |     ,         |

- **Last rotated:**     ,  (fill in on first rotation)
- **Next rotation due:** 2026-10-11 (90 days after baseline; update on rotate)

## Why this isn't automated

- Lovable's rotate endpoint is gated to the workspace owner via the
  Lovable control plane; it is not callable from a GitHub Action or
  `pg_cron` job with a service-role key.
- The anon key is embedded in the client bundle at build time, so any
  rotation requires a rebuild + republish. An unattended rotation would
  break the live site until the next publish.
- The service-role key and database password are not accessible on
  Lovable Cloud at all, so no external orchestrator can be given the
  credentials needed to redeploy after a rotate.
