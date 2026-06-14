# Secure Development Lifecycle (SDLC)

This document is the formal SDLC for MimmoBook. It describes how features are designed, built, reviewed, deployed, and operated with security in mind. It aligns with OWASP SAMM and ISO 27001 Annex A.14.

## 1. Principles

- **Least privilege everywhere**: database roles, edge function service roles, storage signed URLs, UI role gates.
- **Multi-tenancy first**: every public-schema table has Row Level Security; every policy is tenant-scoped; every CI run proves it.
- **Defence in depth**: validation in the browser, the edge function, the database trigger, and the RLS policy.
- **Secure by default**: deny on unknown; require explicit opt-in for any cross-tenant or public access.
- **No secrets in code**: secrets live in the runtime secret store, never in git, never in `import.meta.env` unless explicitly public.

## 2. Design phase

- Every new feature that touches personal data, authentication, payments, or tenant boundaries gets a short threat-modeling note (STRIDE) in the PR description.
- Database changes go through `supabase--migration`, which enforces the four-step pattern: `CREATE TABLE` -> `GRANT` -> `ENABLE RLS` -> `CREATE POLICY`.
- Edge functions enforce input validation with Zod and CORS headers from the Supabase SDK.

## 3. Implementation phase

- All code is written in TypeScript with strict typing where practical.
- HTML rendered from user input is sanitized with DOMPurify.
- Passwords require a 12-character minimum and are checked against Have I Been Pwned at signup and reset.
- `SECURITY DEFINER` database functions must set `search_path = public` explicitly.
- Roles are stored in `user_roles` / `tenant_users`, never on a profile or users table, to prevent privilege escalation.

## 4. Code review

- Every change requires at least one reviewer approval.
- The agent and human reviewers consult `docs/dependency-inventory.md`, the security memory, and the runtime errors knowledge file before approving sensitive changes.
- Pull requests cannot merge until the full required-check matrix passes:
  - `ci`, `lint`, `e2e`, `edge-function-tests`
  - `dependency-audit`, `codeql`
  - `cross-tenant-rls`, `cross-tenant-rls-local`, `cross-tenant-storage-adversarial`
  - `signed-url-malicious-paths`, `storage-path-sanitizer`
  - `rls-cors-gate`, `rls-merge-gate`, `permission-arity`
  - `reservation-type-limit-live`, `tier-trigger-tests`
  - `workflow-security-regression`, `sbom`

## 5. Build and supply chain

- Lockfiles are committed and verified by `lockfile-sync.yml`.
- All GitHub Actions are pinned by commit SHA, enforced by `workflow-security-regression.yml`.
- The CycloneDX 1.5 SBOM is regenerated on every dependency change (`scripts/generate-sbom.mjs`) and verified in CI.
- Dependabot opens PRs for outdated packages; `dependabot-auto-merge.yml` only merges when all required checks pass.

## 6. Deployment

- Frontend: Lovable hosting with CSP headers, HSTS, and security headers configured in the project (see `docs/security/protections`).
- Backend: Supabase-managed Postgres + Edge Functions. Service-role keys are stored in the secret manager and never exposed to the browser.
- Migrations are reviewed and approved by the workspace owner before being run; down-migrations are tested in `down-migrations.yml`.
- Production deploys are immutable; rollback is performed by re-deploying the previous tagged build.

## 7. Operations

- Audit log: 90-day retention, reversible history.
- Email infrastructure: queued via pgmq, retried with DLQ, with TTLs per category.
- Monitoring: superadmin DLQ alert banner, storage rejection alerts, edge function logs.
- Backups: 30-day rolling encrypted backups, restore tested at least annually.

## 8. Incident response

1. Triage in the `#security` internal channel within 30 minutes of detection.
2. Contain (revoke keys, disable accounts, freeze writes if needed).
3. Investigate using the audit log, edge function logs, and storage rejection events.
4. Notify affected customers within 72 hours per the DPA.
5. Post-incident review with documented corrective actions and owners.

## 9. Vendor management

- New subprocessors require a signed DPA and a security review (encryption, access control, region, sub-subprocessors, breach history).
- Existing subprocessors are reviewed annually. Material changes trigger 30 days customer notice.

## 10. Training

- All contributors read this document and the project security memory before their first sensitive change.
- Annual refresher on OWASP Top 10, secret handling, and tenant isolation patterns.

## 11. Review and ownership

Owner: `security@mimmobook.com`. Reviewed at least every 12 months and after any material change to architecture or processing activities.
