import "@testing-library/jest-dom";
import { afterAll, afterEach, vi } from "vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// --- Hanging-process safety net ----------------------------------------------
// CI was occasionally hanging because individual tests would leave timers,
// fake-timer state, or pending mocks attached to module-scoped singletons
// (toast store, password-validation debounce, supabase realtime mocks, etc.).
// With the forks pool each worker is killed at the end of the file batch,
// but if a *single* file leaves a recurring timer running it can still wedge
// the run when Vitest waits for "no active handles" before reporting the
// file as done. Reset the most common offenders centrally.

afterEach(() => {
  // If a test installed fake timers, drop any queued tasks and switch back
  // to real timers so the next test (and Vitest's own teardown) doesn't
  // inherit a frozen clock.
  try {
    vi.useRealTimers();
  } catch {
    /* noop — timers were never faked */
  }
  // Drop any spies/mocks that the test forgot to restore. Without this a
  // leftover `vi.spyOn(window, 'fetch')` keeps the original reference
  // captured, which in turn keeps the dispatcher's keep-alive sockets open.
  vi.restoreAllMocks();
});

afterAll(() => {
  // Final guard before the worker exits.
  try {
    vi.useRealTimers();
  } catch {
    /* noop */
  }
  vi.restoreAllMocks();
});
