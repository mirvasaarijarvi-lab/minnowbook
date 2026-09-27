// Shared cleanup for the guest link integration tests: deletes the throwaway
// links, then reads them back to prove none are left. Runs from each test's
// `finally`, so it also runs when a step fails. Never prints link codes.

// Minimal shape of the Supabase client used here (keeps this unit-testable).
export type CleanupClient = {
  from(table: "booking_tokens"): {
    delete(): { in(col: "token", v: string[]): PromiseLike<{ error: { message: string } | null }> };
    select(cols: "id"): { in(col: "token", v: string[]): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> };
  };
};

export const CLEANUP_ATTEMPTS = 3;

export async function deleteAndVerifyLinks(
  client: CleanupClient,
  tokens: string[],
  opts: { log?: (m: string) => void; wait?: (ms: number) => Promise<void> } = {},
): Promise<void> {
  const log = opts.log ?? ((m) => console.log(m));
  const wait = opts.wait ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  let left = tokens.length;
  let lastError = "";
  for (let attempt = 1; attempt <= CLEANUP_ATTEMPTS; attempt++) {
    const del = await client.from("booking_tokens").delete().in("token", tokens);
    if (del.error) lastError = `delete failed (${del.error.message.slice(0, 80)})`;
    const check = await client.from("booking_tokens").select("id").in("token", tokens);
    if (check.error) {
      lastError = `read-back failed (${check.error.message.slice(0, 80)})`;
      left = -1; // unknown counts as not cleaned
    } else {
      left = check.data?.length ?? 0;
      if (left === 0) {
        log(`cleanup: all ${tokens.length} throwaway links deleted (attempt ${attempt})`);
        return;
      }
    }
    if (attempt < CLEANUP_ATTEMPTS) await wait(500 * attempt);
  }
  throw new Error(
    `cleanup failed: ${left < 0 ? "could not confirm" : left} of ${tokens.length} throwaway links still stored` +
      (lastError ? `; ${lastError}` : ""),
  );
}

// Set GUEST_PORTAL_TEST_FORCE_STEP_FAILURE=1 to make a step fail on purpose,
// so the cleanup can be proven to run after a failed step.
export async function maybeForcedFailure(t: Deno.TestContext): Promise<void> {
  if (Deno.env.get("GUEST_PORTAL_TEST_FORCE_STEP_FAILURE") !== "1") return;
  await t.step("forced failure (cleanup check)", () => {
    throw new Error("forced step failure to check cleanup");
  });
}
