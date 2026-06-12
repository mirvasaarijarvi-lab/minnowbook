# Penetration Testing Policy

## Scope

MimmoBook commissions external penetration tests covering:

- The marketing site at `mimmobook.com`.
- The application at `*.mimmobook.com` (tenant subdomains).
- The public booking pages.
- The authentication and account management flows.
- The Supabase Edge Functions exposed to the internet.
- The storage paths and signed-URL flows.

Out of scope by default (re-scoped per engagement):

- Third-party subprocessors (Supabase, Stripe, Resend, Google).
- Physical security of MimmoBook staff endpoints.
- Social engineering of customers.

## Cadence

- **Annual full-scope penetration test** by an independent, CREST-equivalent or OSCP-led firm.
- **Targeted retests** within 30 days after each major architectural change (new authentication path, new public endpoint, new storage bucket model, new tenant isolation boundary).
- **Internal red-team exercises** at least every 6 months, focused on tenant isolation and IDOR.

## Methodology

External firms follow OWASP WSTG and OWASP ASVS Level 2 as the baseline. Tests include:

- Authenticated and unauthenticated testing for each user role (`staff`, `admin`, `owner`, `superadmin`, anonymous booking visitor).
- Tenant-to-tenant lateral movement.
- IDOR across `reservations`, `resources`, `sites`, `tenant_settings`.
- Storage path tampering and signed URL abuse.
- Authentication bypass, MFA bypass, password reset abuse.
- Rate limiting on login, booking, and email-trigger paths.
- Server-side request forgery via uploaded content or webhook URLs.
- Business logic abuse of discounts, tier enforcement, and trial flows.

## Findings handling

| Severity | Acknowledge | Fix |
|---|---|---|
| Critical | 24 hours | 7 days |
| High | 2 business days | 30 days |
| Medium | 5 business days | 90 days |
| Low | 10 business days | Best effort |
| Informational | Track | Opportunistic |

A written remediation plan is produced for each High or above. Customers can request a redacted executive summary under NDA via `security@mimmobook.com`.

## Internal continuous testing

In addition to external pen tests, the CI pipeline runs adversarial tests on every PR (see `docs/vulnerability-scanning.md`):

- `cross-tenant-rls.yml`, `cross-tenant-rls-local.yml`
- `cross-tenant-storage-adversarial.yml`
- `signed-url-malicious-paths.yml`
- `rls-cors-gate.yml`, `rls-merge-gate.yml`
- `permission-arity.yml`
- `tier-trigger-tests.yml`
- `security-tests.yml`
- `workflow-security-regression.yml`

## Disclosure

Penetration test reports are confidential. The summary status (date, scope, severity counts, remediation status) may be shared with customers under NDA. Detailed findings are never shared externally unless required by law.

## Owner

Security contact: `security@mimmobook.com`. Reviewed annually and after every test.
