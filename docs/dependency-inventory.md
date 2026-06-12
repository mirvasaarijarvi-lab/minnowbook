# Dependency Inventory

This document lists every direct dependency MimmoBook ships, why it is used, and its license category. It is maintained alongside `docs/sbom.cdx.json`, which is the machine-readable source of truth.

Regenerate the SBOM after any dependency change:

```bash
node scripts/generate-sbom.mjs
```

CI also regenerates and verifies it on every PR via `.github/workflows/sbom.yml`.

## Categories

| Category | Purpose |
|---|---|
| **Framework** | Application runtime: React, Vite, TypeScript. |
| **UI** | Design system primitives: shadcn/ui, Radix UI, lucide-react, tailwindcss. |
| **State and data** | React Query, React Hook Form, Zod. |
| **Backend integration** | Supabase JS client, Stripe JS, Resend (server-side only). |
| **Security** | DOMPurify (HTML sanitization), bcrypt (server-side), zod (input validation). |
| **Tooling** | ESLint, TypeScript, Vitest, Playwright, bun. |

## How to inspect

- Full SBOM: `docs/sbom.cdx.json` (CycloneDX 1.5).
- SHA-256 manifest: `docs/sbom.cdx.json.sha256`.
- Direct view of resolved versions: `cat package.json | jq '.dependencies, .devDependencies'`.
- Vulnerability state: see `.github/workflows/dependency-audit.yml` (runs `npm audit` daily and on every PR; high or critical advisories block merge).
- Per-license breakdown: `npx license-checker --summary` (run locally).

## Update policy

- **Pinned**: `react-router` and `react-router-dom` are strictly pinned to `6.28.0` (see `docs/dependency-audit-level.md`).
- **Dependabot**: enabled with auto-merge for patch and minor updates that pass CI (see `.github/workflows/dependabot-auto-merge.yml`).
- **Overrides**: `package.json#overrides` is used to force-resolve transitive dependencies away from known CVEs.
- **Review cadence**: dependency inventory is reviewed quarterly during the security review meeting.
