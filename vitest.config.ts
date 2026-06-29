import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // Skip CSS processing in tests; Vitest doesn't render styles.
  css: false,
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Use the forks pool so each worker is a real child process that gets
    // killed when the run ends. The previous `threads` pool kept worker
    // threads attached to the main Node process, which meant any leaked
    // timer / fetch keep-alive socket / supabase realtime channel held the
    // event loop open and made `vitest run` hang in CI past the job
    // timeout. Forks trade a small startup cost for a guaranteed clean
    // exit, which is the right call for CI.
    pool: "forks",
    poolOptions: {
      forks: {
        // Keep parallelism — only force singleFork when explicitly debugging.
        singleFork: false,
        isolate: true,
      },
    },
    // Don't wait forever on a stuck afterAll/afterEach hook.
    teardownTimeout: 10_000,
    // Many security regression suites hit the live Supabase project over
    // the public network (anon-client RLS probes, PostgREST count leaks,
    // cross-tenant log isolation). The default 5s per-test timeout is too
    // tight when the runner's egress to Supabase is even slightly slow:
    // a single TCP/TLS handshake + first PostgREST response can eat 3-4s
    // by itself, and any retry blows the budget. Bumping to 30s keeps
    // local runs snappy (fast tests still finish in ms) while preventing
    // an entire CI run from being declared a "real regression" purely
    // because of network latency to the live project.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Belt-and-braces: if a test still leaves a handle open after teardown,
    // surface it as a hard failure instead of an indefinite hang. Vitest
    // will print the offending handle and exit non-zero.
    // (Reporter `hanging-process` can be added on the CLI when triaging.)
    // Don't scan node_modules or build output for tests.
    exclude: ["node_modules", "dist", ".idea", ".git", ".cache", "e2e", "playwright"],
    // Reduce reporter overhead in CI; scripts/test-ci.sh adds --bail=1 + --reporter=dot.
    passWithNoTests: false,
    // CI-friendly report files. The dot reporter is added on the CLI in
    // scripts/test-ci.sh so local `vitest` runs stay quiet.
    outputFile: {
      junit: "test-reports/vitest/junit.xml",
      json: "test-reports/vitest/results.json",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
