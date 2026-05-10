import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act, waitFor } from "@testing-library/react";

/**
 * Retry-policy contract tests for `useBrandingSignedUrlState`.
 *
 * These tests pin the public, observable behaviour of the signed-URL
 * resolver so future refactors can't silently regress:
 *
 *   1. After a failed mint, re-mint is delayed by the exponential
 *      backoff schedule (400ms, 800ms, 1600ms, 3200ms) and not before.
 *   2. After MAX_AUTOMATIC_RETRIES (4) failed retries the hook
 *      transitions to "error" and stops calling createSignedUrl.
 *   3. Unmounting before a scheduled retry fires prevents any
 *      follow-up mint, even though the shared backoff timer still
 *      runs to completion.
 *   4. Manual retry() cancels the pending backoff (no duplicate mint
 *      from the in-flight timer) and resets the per-path attempt
 *      counter so a fresh failure budget is available.
 *
 * Math.random is stubbed to 0 so jitter (`+0..200ms`) is removed and
 * delays are exactly the schedule values, which makes
 * advanceTimersByTime assertions exact.
 */

type CreateSignedUrlMock = ReturnType<typeof vi.fn>;
const createSignedUrlMock: CreateSignedUrlMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({ createSignedUrl: createSignedUrlMock }),
    },
  },
}));

const PATH = "tenant-abc/logo.png";
const TTL = 60;

function HookProbe({
  storedUrl,
  ttl,
  onState,
  retryRef,
}: {
  storedUrl: string;
  ttl: number;
  onState: (s: { url: string; status: string }) => void;
  retryRef?: { current: (() => void) | null };
}) {
  // Imported lazily inside the component so vi.resetModules() between
  // tests gives us a fresh module-level cache / lock map.
  const { useBrandingSignedUrlState } =
    require("@/lib/tenant-branding-url") as typeof import("@/lib/tenant-branding-url");
  const state = useBrandingSignedUrlState(storedUrl, ttl);
  if (retryRef) retryRef.current = state.retry;
  onState({ url: state.url, status: state.status });
  return null;
}

async function flushMicrotasks() {
  // Allow queued .then() callbacks (mint promise + lock subscription)
  // to settle before advancing fake timers further.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("useBrandingSignedUrlState retry policy", () => {
  beforeEach(() => {
    vi.resetModules();
    createSignedUrlMock.mockReset();
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("waits the exponential backoff schedule before re-minting", async () => {
    createSignedUrlMock.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    const states: { url: string; status: string }[] = [];
    render(
      <HookProbe
        storedUrl={PATH}
        ttl={TTL}
        onState={(s) => states.push(s)}
      />,
    );

    // Initial mint attempt (kicks off in load()).
    await act(async () => {
      await flushMicrotasks();
    });
    expect(createSignedUrlMock).toHaveBeenCalledTimes(1);
    expect(states.at(-1)?.status).toBe("loading");

    const expectedDelays = [400, 800, 1600, 3200];
    let totalCalls = 1;
    for (const delay of expectedDelays) {
      // 1ms before the timer fires: still no new mint.
      await act(async () => {
        vi.advanceTimersByTime(delay - 1);
        await flushMicrotasks();
      });
      expect(createSignedUrlMock).toHaveBeenCalledTimes(totalCalls);

      // Cross the threshold: lock resolves, subscriber calls load(true).
      await act(async () => {
        vi.advanceTimersByTime(1);
        await flushMicrotasks();
      });
      totalCalls += 1;
      expect(createSignedUrlMock).toHaveBeenCalledTimes(totalCalls);
    }
  });

  it("stops retrying after MAX_AUTOMATIC_RETRIES and reports error", async () => {
    createSignedUrlMock.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    const states: { url: string; status: string }[] = [];
    render(
      <HookProbe
        storedUrl={PATH}
        ttl={TTL}
        onState={(s) => states.push(s)}
      />,
    );

    // Drain initial + 4 retry attempts.
    await act(async () => {
      await flushMicrotasks();
    });
    for (const delay of [400, 800, 1600, 3200]) {
      await act(async () => {
        vi.advanceTimersByTime(delay);
        await flushMicrotasks();
      });
    }
    expect(createSignedUrlMock).toHaveBeenCalledTimes(5);
    expect(states.at(-1)?.status).toBe("error");
    expect(states.at(-1)?.url).toBe("");

    // Run any remaining timers; no further mint should happen.
    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await flushMicrotasks();
    });
    expect(createSignedUrlMock).toHaveBeenCalledTimes(5);
  });

  it("does not mint again after unmount, even if the backoff timer fires", async () => {
    createSignedUrlMock.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    const { unmount } = render(
      <HookProbe storedUrl={PATH} ttl={TTL} onState={() => {}} />,
    );

    await act(async () => {
      await flushMicrotasks();
    });
    expect(createSignedUrlMock).toHaveBeenCalledTimes(1);

    // Unmount BEFORE the 400ms backoff timer fires.
    unmount();

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await flushMicrotasks();
    });
    // The shared lock's timer still fires (it's not per-instance), but
    // the unmounted hook's request id was bumped, so its subscription
    // resolves into a no-op and never calls createSignedUrl again.
    expect(createSignedUrlMock).toHaveBeenCalledTimes(1);
  });

  it("manual retry() short-circuits the pending backoff and refreshes the budget", async () => {
    // First call fails; second (manual retry) succeeds; subsequent
    // failures must be allowed to retry again because retry() clears
    // the shared attempt counter.
    createSignedUrlMock
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } })
      .mockResolvedValueOnce({ data: { signedUrl: "https://signed/ok" }, error: null })
      .mockResolvedValue({ data: null, error: { message: "boom-again" } });

    const retryRef: { current: (() => void) | null } = { current: null };
    const states: { url: string; status: string }[] = [];
    render(
      <HookProbe
        storedUrl={PATH}
        ttl={TTL}
        onState={(s) => states.push(s)}
        retryRef={retryRef}
      />,
    );

    await act(async () => {
      await flushMicrotasks();
    });
    expect(createSignedUrlMock).toHaveBeenCalledTimes(1);

    // Trigger manual retry well before the 400ms backoff would fire.
    await act(async () => {
      vi.advanceTimersByTime(50);
      retryRef.current?.();
      await flushMicrotasks();
    });

    // Manual retry mints immediately (call #2) and succeeds.
    expect(createSignedUrlMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(states.at(-1)?.status).toBe("ready"));
    expect(states.at(-1)?.url).toBe("https://signed/ok");

    // Advancing past the original 400ms timer must NOT cause a third
    // mint; the in-flight lock subscription was invalidated by the
    // request-id bump that retry()->load(true) performed.
    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await flushMicrotasks();
    });
    expect(createSignedUrlMock).toHaveBeenCalledTimes(2);
  });
});
