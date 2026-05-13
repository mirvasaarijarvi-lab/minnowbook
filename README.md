# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## SPA shell returns 200, but a real 403 is observable

This app is a Vite single-page application served from a static host. Every
deep link (including `/forbidden`, `/superadmin`, etc.) is rewritten by the
host to `index.html` and served with **HTTP 200** so the React Router can
take over on the client. There is no way to make the document itself carry
a 403 status code without server-side rendering.

That creates a real monitoring problem: synthetic checks, security scanners,
and audit pipelines that look at HTTP status codes would never see a denial,
even when a user is actually blocked from a protected route. To close that
gap, the `Forbidden` page (`src/pages/Forbidden.tsx`) emits a beacon to a
dedicated edge function — [`supabase/functions/forbidden-status`](./supabase/functions/forbidden-status/index.ts)
— which **always responds with HTTP 403** and includes the attempted area
in its body. The result:

- The user sees the 403 UI immediately, regardless of beacon outcome.
- The browser network log contains a real `403 Forbidden` entry tied to
  the denial, with the attempted area as a query parameter.
- A second beacon to `log-forbidden-access` writes the denial to
  `audit_log` (user id, path, timestamp) for tenant owners and system
  admins to review.
- The page also sets `<meta http-equiv="Status" content="403 Forbidden">`,
  `<meta name="robots" content="noindex, nofollow">`, and
  `data-http-status="403"` on `<main>` so crawlers, scanners, and
  end-to-end tests have stable hooks.

The beacon is fire-and-forget (raw `fetch` with `keepalive: true`,
`credentials: "omit"`, and a 4 s `AbortController` timeout). If the edge
function is unreachable — DNS failure, CORS rejection, opaque error, or
abort — `data-status-beacon` becomes `"unreachable"` and rendering is
unaffected.

### How to validate it

**1. Manually, in the browser.** Sign in as a non-system-admin and navigate
to `/superadmin`. In DevTools → Network, filter for `forbidden-status` and
confirm the request returns `403 Forbidden`. Inspect `<main>` and check
that `data-http-status="403"` and `data-status-beacon="403"` are present.

**2. Via curl, as a synthetic check.** The function is publicly callable:

```sh
curl -i "$VITE_SUPABASE_URL/functions/v1/forbidden-status?area=superadmin"
# → HTTP/2 403
# → content-type: application/json
# → {"status":403,"area":"superadmin"}
```

Any monitor that asserts `status_code == 403` for this URL will catch
regressions where the edge function starts returning 200 (which would
silently break the audit signal even though the UI still shows the page).

**3. Via the audit log.** As a system admin, open the dashboard → Audit Log
panel and filter for `forbidden_access` actions. Each forbidden navigation
by an authenticated user produces one row.

**4. In automated tests.** The Playwright suite under `e2e/` and the
forbidden-flow tests under `src/components/SystemAdminRoute.test.tsx`
exercise the redirect path; the Vitest edge-function tests in
[`supabase/functions/forbidden-status`](./supabase/functions/forbidden-status)
assert the always-403 behavior. Run `bun test` and
`npx playwright test` to validate end-to-end.


<!-- ci: trigger 2026-05-13T16:28:42Z -->
