# Linting policy

ESLint is a blocking CI gate. `bun run lint` runs with `--max-warnings=0`, so a
warning fails the build exactly like an error. That means every rule we keep on
must be one we are willing to fix, and every deliberate exception must be
narrow, justified and written down here.

## Always enforced

| Rule | Level | Why |
| --- | --- | --- |
| `react-hooks/rules-of-hooks` | error | Conditional hook calls corrupt React state. |
| `react-hooks/exhaustive-deps` | error | Missing dependencies produce stale reservations, prices and availability data. |
| `no-restricted-imports` (`server-only`) | error | TanStack Start uses `*.server.ts`, not the Next.js package. |
| `prettier/prettier` | error | Formatting stays mechanical, not reviewed by hand. |

These are never disabled by a file-scoped block. When a dependency genuinely
must be excluded, use a single inline exception at the call site with a comment
that explains the reason:

```ts
// onNavigate/step.view are intentionally excluded: including them re-triggers
// navigation on every parent re-render.
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [stepIndex]);
```

Current inline hook exceptions:

- `src/components/dashboard/GuidedTour.tsx` - excluding `onNavigate` / `step.view`
  prevents a navigation loop on each parent re-render.
- `src/components/dashboard/OpeningHoursSettings.tsx` - depends on a derived
  `reservationTypesKey` string instead of the array identity.

## Targeted exception: `react-refresh/only-export-components`

This rule is advisory. It warns when a module exports something besides a
component, because React Fast Refresh then falls back to a full page reload for
that module during development. It says nothing about runtime correctness.

Some modules intentionally co-locate non-component exports. Splitting them would
add indirection without improving the product, so the rule is turned off for
exactly these paths in `eslint.config.js`:

| Path | Intentional co-located export |
| --- | --- |
| `src/components/ui/**/*.tsx` | shadcn variant maps (`buttonVariants`) and small helpers shipped with each primitive. |
| `src/contexts/**/*.tsx` | the context object and its `use*` hook next to the provider. |
| `src/routes/**/*.tsx` | TanStack `Route` objects, `loader`s and `head()` metadata required to live in the route file. |
| `src/lib/router-compat.tsx` | router compatibility helpers plus the wrapper component. |
| `src/components/SEOHead.tsx` | shared metadata builders used by routes and tests. |
| `src/components/CookieConsent.tsx` | consent read/write helpers used outside React. |
| `src/components/ConfirmationEmailPreview.tsx` | email template helpers reused by the mail pipeline. |

Rules for changing that list:

1. Disable only `react-refresh/only-export-components`. Never add a
   `react-hooks` entry to that block.
2. Add a path only for a genuinely intentional co-located export, never to
   silence a fixable warning.
3. Add the path to the table above in the same change.
4. Prefer moving the helper into a plain `.ts` module when it has no reason to
   sit next to the component.

## Ignored paths

Generated and downloaded output is not linted: `dist`, `.output`, `.vinxi`,
`.deno-cache`, `.cache`, `coverage`, `test-reports`, `playwright-report`,
`blog-jsonld-report`, `reports`, `drizzle/**/*.sql` and `supabase/functions`
(Deno runtime, checked by `deno lint`). Generated Supabase clients under
`src/integrations/supabase/` keep linting but skip `prefer-const` and Prettier.

## Commands

```bash
bun run lint          # errors and warnings both fail (--max-warnings=0)
bun run lint -- --fix # auto-fixable issues, mostly formatting
```

CI runs the same command with a cache keyed on `eslint.config.js`, `bun.lock`
and `package.json`, so any rule change invalidates the cache and relints the
whole tree.
