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
    // Faster startup than the default forks pool, and avoids per-file process boot.
    pool: "threads",
    poolOptions: {
      threads: { singleThread: false, isolate: true },
    },
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

