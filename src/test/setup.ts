import "@testing-library/jest-dom";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

// ---------------------------------------------------------------------------
// Known-benign console.error patterns
// ---------------------------------------------------------------------------
// We deliberately silence a tight list of React/Radix warnings that are
// noisy in CI but do not represent real regressions. Every entry MUST be
// matched by an exact substring/regex so unrelated errors still surface.
// Prefer fixing the source over broadening the patterns.
//
// 1. "not wrapped in act(...)" from <Forbidden>'s background beacon effects.
//    The page fires two fire-and-forget effects (forbidden-status beacon +
//    log-forbidden-access invoke) that resolve after the test assertion has
//    returned. State updates are guarded by a `cancelled` flag; rewriting
//    every Forbidden test to await both promises would add complexity
//    without changing behaviour.
// 2. "Function components cannot be given refs" from <Badge>. Fixed via
//    forwardRef in src/components/ui/badge.tsx; kept as a fallback in case
//    a stale build artefact triggers it during a transition window.
// 3. "Missing `Description` or `aria-describedby={undefined}` for {DialogContent}".
//    Radix logs this as an a11y hint, not an error. Dedicated dialog-a11y
//    tests cover the real requirement.
const SILENCED_CONSOLE_ERROR_PATTERNS: readonly (string | RegExp)[] = [
  "not wrapped in act(",
  "Function components cannot be given refs",
  /Missing `Description` or `aria-describedby=\{undefined\}` for \{DialogContent\}/,
];

const originalConsoleError = console.error.bind(console);

beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const first = args[0];
    const message =
      typeof first === "string"
        ? first
        : first instanceof Error
          ? first.message
          : "";
    for (const pattern of SILENCED_CONSOLE_ERROR_PATTERNS) {
      const matched =
        typeof pattern === "string"
          ? message.includes(pattern)
          : pattern.test(message);
      if (matched) return;
    }
    originalConsoleError(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});

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
