# E2E staff login secrets

Some browser tests (offers, staffing) sign in as a staff member. On GitHub
they read the login from two repository secrets. When a secret is missing,
those tests are skipped and the run shows a warning.

| Secret | Value |
| --- | --- |
| `E2E_STAFF_EMAIL` | `e2e-staff@mimmobook.com` |
| `E2E_STAFF_PASSWORD` | The password of that login |

## Steps

1. Open the repository on GitHub.
2. Go to **Settings > Secrets and variables > Actions**.
3. Click **New repository secret**.
4. Name: `E2E_STAFF_EMAIL`, secret: `e2e-staff@mimmobook.com`. Save.
5. Click **New repository secret** again.
6. Name: `E2E_STAFF_PASSWORD`, secret: the login's password. Save.
7. Re-run the E2E workflow and check the offer tests are no longer skipped.

## Notes

- The password is not stored anywhere in the project. If nobody knows it,
  reset it through "Forgot password" on the sign-in page, then paste the new
  one into `E2E_STAFF_PASSWORD`.
- The login must not use two-step sign-in. A six-digit code screen blocks
  the tests.
- The login is an owner of the test business `mimmin-testi` only. Never use a
  real person's account.
- Pull requests from forks cannot read secrets, so these tests are skipped
  there.
- After changing the password, update `E2E_STAFF_PASSWORD` right away, or
  the tests fail at sign-in.
