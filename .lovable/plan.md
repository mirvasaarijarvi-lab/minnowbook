

## Add Redeem Code to Login Page

**Goal**: Add a collapsible "Have a code?" section on the login page, positioned between the login form and the "No account?" signup link. This lets users enter any access/beta/discount code before or alongside signing in, streamlining the flow.

**Approach**:
- Add a lightweight, collapsible section directly in `Login.tsx` (no need for the full `RedeemAccessCode` card component, since that requires authentication)
- Position it after the login button but