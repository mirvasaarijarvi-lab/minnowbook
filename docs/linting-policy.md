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

## `react-refresh/only-export-components`

This rule warns when a module exports something besides a component, because
React Fast Refresh then falls back to a full page reload for that module during
development.

There is no longer any file-scoped exception block for it. Non-component
exports live in their own modules instead:

| Module | Non-component exports moved out of it |
| --- | --- |
| `src/components/ui/button.tsx`, `badge.tsx`, `toggle.tsx`, `navigation-menu.tsx` | variant maps in sibling `*-variants.ts` modules. |
| `src/components/ui/form.tsx`, `sidebar.tsx` | context objects, constants and `useFormField` / `useSidebar` in sibling `*-context.ts` modules. |
| `src/components/ui/sonner.tsx` | `toast` is imported from the `sonner` package directly. |
| `src/contexts/AuthContext/`, `I18nContext/`, `ImpersonationContext/` | directories with `context.ts` (context object, types, hooks), a provider component file and an `index.ts` barrel, so `@/contexts/...` import paths stay unchanged. |
| `src/lib/router-compat/` | `hooks.ts`, `components.tsx`, `internal.ts` plus an `index.ts` barrel. |
| `src/components/SEOHead.tsx` | metadata builders in `src/lib/seo-urls.ts` and `src/lib/seo-schemas.ts`. |
| `src/components/CookieConsent.tsx` | `openCookieSettings` in `src/lib/cookie-consent.ts`. |
| `src/components/ConfirmationEmailPreview.tsx` | branding-URL helpers in `src/lib/persisted-branding-url.ts`. |

The only remaining exception is an inline, justified file-level disable in
`src/routes/__root.tsx`: TanStack Start requires the root `Route` object to sit
in the same file as the shell, root, not-found and error components.

Rules for new exceptions:

1. Move the non-component export into a plain `.ts` module, or use a barrel
   directory when many call sites import the existing path.
2. Reach for an inline `eslint-disable` only when the framework requires the
   co-located export, and state the reason in the comment.
3. Never add a file-scoped block that relaxes a `react-hooks` rule.

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
