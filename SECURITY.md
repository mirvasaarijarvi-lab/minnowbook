# Security Policy

MimmoBook is a multi-tenant reservation platform. Because tenant data isolation
is a core guarantee, we treat every report about access control, authentication,
or data leakage as high priority.

## Supported Versions

MimmoBook is a continuously deployed hosted service, so there are no long-lived
release branches. Security updates always land on `main` and are deployed from
there.

| Version                       | Supported          |
| ----------------------------- | ------------------ |
| `main` (current deployment)   | :white_check_mark: |
| Older commits / forks         | :x:                |

Self-hosted copies of the code are supported only when they track `main`. Fixes
are not backported to earlier commits.

## Reporting a Vulnerability

Please report security issues privately. Do not open a public issue, pull
request, or discussion for a suspected vulnerability.

Preferred channels:

1. GitHub private vulnerability reporting: the **Security** tab of this
   repository, then **Report a vulnerability**.
2. Email: security@mimmobook.com

Please include, where possible:

- A description of the issue and its impact.
- Steps to reproduce, or a minimal proof of concept.
- Affected URL, page, or endpoint, and the time of your test.
- Any test account or tenant you used (never include another person's
  credentials or personal data).

## What to Expect

| Stage                           | Target                                  |
| ------------------------------- | --------------------------------------- |
| Acknowledgement of your report  | Within 2 business days                  |
| Initial assessment and severity | Within 5 business days                  |
| Fix for critical or high issues | As soon as possible, normally 7 days    |
| Fix for medium or low issues    | Normally within 30 days                 |
| Follow-up while work continues  | At least every 7 days until resolved    |

If the report is accepted, we confirm the severity, fix it on `main`, deploy it,
and tell you when the fix is live. If the report is declined, for example because
it is intended behaviour or out of scope, we explain the reasoning. You are
welcome to challenge that decision with additional detail.

We are happy to credit reporters in the release notes. Tell us the name you want
used, or say if you prefer to stay anonymous. We do not currently run a paid
bounty programme.

## Scope

In scope:

- The hosted application and its subdomains (tenant booking pages, dashboard,
  public marketing pages).
- Authentication, multi-factor authentication, session handling, and password
  policy.
- Tenant isolation and row level security, including any way to read or modify
  another tenant's data.
- Privilege escalation between guest, staff, tenant administrator, and platform
  administrator roles.
- Server-side logic, backend functions, storage buckets, and signed URL
  handling.
- Injection, cross-site scripting, cross-site request forgery, and open
  redirects.
- Exposure of secrets, personal data, or billing information.

Out of scope:

- Findings that only apply to unsupported or heavily outdated browsers.
- Missing hardening headers or best practice suggestions with no demonstrated
  impact.
- Reports produced solely by automated scanners without a working proof of
  concept.
- Denial of service, volumetric, brute force, or load testing against
  production.
- Social engineering, phishing, or physical attacks against staff or customers.
- Email configuration findings such as SPF, DKIM, or DMARC on domains we do not
  control.
- Vulnerabilities in third party services we integrate with; please report those
  to the service in question.

## Testing Guidelines

- Use your own tenant and your own test data.
- Do not access, modify, or delete data belonging to other tenants or guests.
- Stop as soon as you have confirmed a vulnerability, and report it.
- Do not run automated scanners at a rate that degrades service for others.
- Never exfiltrate personal data. A screenshot proving access is enough, with
  personal data redacted.

Good faith research that follows these guidelines is welcome, and we will not
pursue action against researchers who abide by this policy.

## Our Own Security Practices

For background on how the project is built and audited, see
`docs/secure-development.md` and the dependency handling rules in
`docs/dependency-update-workflow.md`. Dependency advisories are tracked
automatically on every pull request, and a software inventory is published with
each build.
