// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// E2E_PREVIEW_BUILD=1 disables the nitro deploy plugin so `vite build` emits the
// plain TanStack Start server bundle at dist/server/server.js, which
// `vite preview` (the Playwright webServer) can actually run. The default
// cloudflare-module bundle needs Cloudflare bindings (env.ASSETS) and can only
// be served by wrangler, which made every Playwright run fail with
// ERR_MODULE_NOT_FOUND dist/server/server.js followed by HTTP 500s.
// Deploy builds are untouched: no env var, no behaviour change.
const isE2EPreviewBuild = process.env["E2E_PREVIEW_BUILD"] === "1";

export default defineConfig({
  ...(isE2EPreviewBuild ? { nitro: false as const } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
