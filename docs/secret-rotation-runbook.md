# Secret Rotation Runbook

How to replace a credential, whether it is routine maintenance or a suspected
exposure. Run the guide rather than working from memory:

```bash
bun run secrets:list                                  # what exists, who owns it, cadence
bun run secrets:rotate -- --plan STRIPE_SECRET_KEY    # ordered steps for one credential
bun run secrets:rotate -- --plan RESEND_API_KEY --compromised
bun run secrets:check                                 # presence only, never values
```

The inventory lives in `scripts/ci/secret-inventory.json`. It records names,
owners, cadence, blast radius and per-credential steps. It never records values,
and neither does any output of the tool.

## Golden rules

1. A credential value never enters chat, a file, a commit, a screenshot or a log.
   Values are entered only through the Lovable secret form or the provider's own
   dashboard.
2. Rotate first, investigate second, whenever exposure is even plausible.
3. Creating a new value at a third-party provider does **not** disable the old
   one. Revoke the old one explicitly, after the new one is proven working.
4. Anything embedded in the published app, or read by server code, keeps using
   the old value until the app is republished. The republish is part of the
   rotation.
5. A shared secret (webhook signing) must be identical on both sides. Never mint
   it with a generator whose value is never shown, because the provider needs the
   same string.

## Suspected exposure

1. Open an incident record and set severity per `docs/incident-response.md`.
   A leaked service role key or publishable key is at least SEV-2.
2. Run the guide with `--compromised`. It adds revocation and access-review
   steps in the right order.
3. Rotate, republish, verify.
4. Revoke the old value at the provider and confirm it now fails.
5. Clean up the leak itself. A value committed to a public repository must be
   treated as burned even after the commit is removed, because history and forks
   persist.
6. Review what the old value could have touched: the audit log, the reservation
   access log, and the provider's own request history.
7. Record the rotation in `docs/key-rotation-schedule.md` and close the finding
   or issue that tracked the exposure.

## Routine rotation

Follow the cadence in the inventory (90 days for backend keys, 180 for provider
and shared secrets, 365 for the reporting connector). Rotate out of cycle when
someone with production access leaves, when a scanner flags a value, or when
traffic looks unexplained.

## By credential kind

| Kind              | Replaced by                                  | Old value dies |
| ----------------- | -------------------------------------------- | -------------- |
| Cloud managed     | Agent rotates backend keys, then republish    | immediately    |
| Platform managed  | Agent rotates the Lovable key, then republish | within an hour |
| Third party       | New key in provider dashboard, saved in form  | only on revoke |
| Connector managed | Reconnect the connection                      | immediately    |
| Shared            | You generate it, both sides updated together  | only on revoke |

## Verification

Each plan ends with the checks that matter for that credential. The full local
gate is:

```bash
bun install --frozen-lockfile --ignore-scripts
bunx tsgo --noEmit
bun run lint
bun run test
bunx vite build
```

For backend keys also run the live security suites (`bun run test:security`) so a
stale copy surfaces immediately.

## Prevention

- Push protection and secret scanning are enabled on the repository, so a
  credential in a commit is blocked before it lands. If a push is blocked,
  remove the value and store it as a project secret. Do not bypass the block.
- Every build publishes a software inventory and grades new advisories, see
  `docs/dependency-update-workflow.md`.
- Related reading: `docs/key-rotation-schedule.md` (the log),
  `docs/incident-response.md` (severity and notification),
  `docs/secure-development.md` (day to day rules).
