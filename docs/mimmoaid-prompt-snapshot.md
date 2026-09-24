# Updating MimmoAid's saved instruction copy

MimmoAid's system prompt lives in `supabase/functions/support-chat/prompt.ts`.
`src/test/support-chat-prompt.snapshot.test.ts` compares it against a saved copy in
`src/test/__snapshots__/support-chat-prompt.snapshot.test.ts.snap`. Any change to the
prompt fails CI ("Real regression in vitest ... locks the full system prompt") until
the saved copy is updated. This stops the prompt from changing by accident.

## When the change is intentional

Examples: new help text for a feature, updated pricing wording, new FAQ entries.

1. Edit `prompt.ts`, keeping EN, FI and SV in step and following the copy rules (no em or en dashes, ranges use "to").
2. Run the test and read the diff it prints, so you can confirm only your intended lines changed:
   `bunx vitest run src/test/support-chat-prompt.snapshot.test.ts`
3. Refresh the saved copy:
   `bunx vitest run src/test/support-chat-prompt.snapshot.test.ts -u`
4. Commit `prompt.ts` and the updated `.snap` file **in the same commit**.
5. Redeploy the `support-chat` function so the live MimmoAid matches.
6. When the help text describes a product feature, update the matching pages too: pricing table, features page, support page FAQ and the staff quick guide.

## When the change is not intentional

Do not run `-u`. Find out what changed `prompt.ts` (a formatter, a merge or a stray edit), revert it, and rerun the test.

## Review checklist

- The `.snap` diff contains only the intended wording.
- There are no secrets, tenant data or internal URLs in the prompt.
- Do not quarantine this test in `.github/flaky-tests.json`. It is deterministic, so a failure always means the prompt changed.
