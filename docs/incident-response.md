# MimmoBook Incident Response Plan

Owner: Security Lead (security@mimmobook.com)
Last reviewed: 2026-06-12
Review cadence: Every 6 months, or after any Severity 1/2 incident.

## 1. Purpose & Scope

This plan defines how MimmoBook detects, triages, contains, eradicates, recovers from, and learns from security incidents affecting the MimmoBook SaaS platform, its customer data, and supporting infrastructure (database, edge functions, storage, CI/CD, marketing site).

It applies to all employees, contractors, and integrators with access to production systems or customer data.

## 2. Definitions

- **Event** — An observable occurrence (failed login, error, alert).
- **Incident** — An event (or series) that compromises or threatens the confidentiality, integrity, or availability of MimmoBook systems or data.
- **Personal Data Breach (GDPR Art. 4(12))** — A breach of security leading to accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to, personal data.

## 3. Severity Levels & Response SLAs

| Severity | Example | Acknowledge | Initial Mitigation | Customer Notification |
| --- | --- | --- | --- | --- |
| SEV-1 (Critical) | Confirmed data breach; production down; auth bypass in the wild | 15 min | 1 hour | Per GDPR: within 72 h to supervisory authority; affected users without undue delay |
| SEV-2 (High) | Privilege escalation, exposed credentials, RLS bypass without confirmed exfiltration | 30 min | 4 hours | Within 7 days if user impact confirmed |
| SEV-3 (Medium) | Single-tenant data integrity issue, partial outage, exploitable bug without active exploitation | 4 hours | 2 business days | If user-visible |
| SEV-4 (Low) | Hardening gap, low-impact misconfiguration, scanner finding | 2 business days | Next sprint | Not required |

## 4. Roles

- **Incident Commander (IC)** — Owns the response, declares severity, coordinates workstreams. Default: on-call Security Lead.
- **Communications Lead** — Drafts customer, regulator, and internal communications. Default: Founder/CEO.
- **Tech Lead** — Drives technical investigation, containment, and remediation.
- **Scribe** — Maintains the incident timeline in the incident channel and final report.
- **Legal/DPO** — Assesses GDPR notification obligations for personal data breaches.

For solo or small-team coverage, the IC may hold multiple roles but must explicitly name them in the incident log.

## 5. Lifecycle

### 5.1 Detection & Reporting

Sources:
- Aikido continuous scanning alerts (workspace-scoped).
- GitHub Dependabot alerts and the `dependency-scan` / `sbom` CI workflows.
- Supabase logs, edge function logs, and security memory findings.
- Customer reports via `security@mimmobook.com` or the `/security` page.
- Internal staff reports via the superadmin **Security Documentation** panel.

Anyone observing a possible incident MUST email `security@mimmobook.com` within 1 hour of discovery. External reporters are governed by the public Vulnerability Disclosure Policy (`/security`).

### 5.2 Triage

The on-call IC opens a private incident channel, assigns severity per §3, and creates an incident record (date, reporter, systems, suspected impact). For suspected personal data breaches, the DPO is paged immediately and a GDPR 72-hour clock starts at the time the breach becomes "known" to MimmoBook.

### 5.3 Containment

Short-term: disable affected accounts, rotate keys (`lovable_api_key--rotate_lovable_api_key`, Supabase service role, Stripe, GTM, GA), tighten RLS, block IPs, take suspect workflows offline.
Long-term: deploy hotfix migrations and edge function updates; confirm via security scan (`security--run_security_scan`).

### 5.4 Eradication

Remove the root cause: revoke leaked secrets, delete malicious data, patch dependencies (`bun update`), update RLS policies, and add regression tests under `src/test/security/`.

### 5.5 Recovery

Restore services from clean state, monitor for recurrence for at least 72 hours, and re-enable any temporarily disabled features only after IC sign-off.

### 5.6 Post-Incident Review

Within 10 business days the IC publishes a blameless post-mortem covering: timeline, impact, root cause, what worked, what didn't, and concrete action items with owners and due dates. SEV-1/2 reviews are shared with the full team.

## 6. Communications

- **Internal** — Incident channel + daily standup updates for SEV-1/2.
- **Customers** — Status updates on `mimmobook.com/security` and direct email to affected tenants.
- **Regulator (Finnish Data Protection Ombudsman / lead supervisory authority)** — Within 72 h of becoming aware of a personal data breach, per GDPR Art. 33, unless unlikely to result in a risk to data subjects.
- **Data subjects** — Without undue delay where the breach is likely to result in a high risk to their rights and freedoms (GDPR Art. 34).

Template communications are stored alongside this document and reviewed annually.

## 7. Evidence Handling

Preserve logs, database snapshots, and edge function execution traces for at least 12 months for SEV-1/2 incidents. Restrict access to the IC, Tech Lead, and Legal. Do not modify evidence; work from copies.

## 8. Testing

- **Tabletop exercise**: at least once per year, covering one realistic scenario (e.g. leaked service role key, RLS bypass, ransomware on a developer laptop).
- **Dependency drill**: quarterly review of Dependabot + Aikido backlog with sign-off in the superadmin Security Documentation panel.
- **Restore drill**: quarterly test of database point-in-time recovery for a non-production tenant snapshot.

## 9. Related Documents

- `docs/secure-development.md` — Secure SDLC
- `docs/vulnerability-scanning.md` — Scanning pipeline (Dependabot, Aikido, CI)
- `docs/penetration-testing-policy.md` — Pen test cadence and scope
- `docs/dependency-inventory.md` — Dependency inventory
- `docs/sbom.cdx.json` — CycloneDX SBOM (regenerated on each release)
- `docs/ropa.md` — Record of Processing Activities
- `public/.well-known/security.txt` — Machine-readable disclosure contact
- `src/pages/Security.tsx` — Public vulnerability disclosure policy
