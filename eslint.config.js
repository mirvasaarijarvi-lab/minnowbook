import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Build output, generated reports and third-party caches must never be
    // linted. In CI the Deno module cache is restored into
    // `${{ github.workspace }}/.deno-cache` BEFORE the lint step, so without
    // this ignore ESLint walked tens of thousands of downloaded remote
    // modules and the "Lint (ESLint)" step appeared to hang for the rest of
    // the job's 60-minute budget.
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      ".deno-cache",
      ".cache",
      "coverage",
      "test-reports",
      "playwright-report",
      "blog-jsonld-report",
      "reports",
      "drizzle/**/*.sql",
      "supabase/functions",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Hook correctness is a CI gate, never an advisory warning. Stale or
      // missing dependencies cause real data bugs, so these stay at "error"
      // everywhere and are never relaxed by the per-file blocks below.
      // Individual, justified exceptions use an inline eslint-disable comment
      // that states why the dependency is excluded. See docs/linting-policy.md.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  eslintPluginPrettier,
  {
    // Auto-generated integration clients are not hand-edited.
    files: ["src/integrations/supabase/**/*.ts"],
    rules: {
      "prefer-const": "off",
      // Generated clients/types are emitted by tooling, not formatted by us.
      "prettier/prettier": "off",
    },
  },
  {
    // Test fixtures use Playwright/Vitest helpers named like React hooks.
    files: ["e2e/**/*.ts", "src/test/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
