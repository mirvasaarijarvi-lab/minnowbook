// Single source of truth for the repo-wide Node.js floor.
//
// @supabase/supabase-js constructs a realtime client at import time and that
// client needs a native global WebSocket, which Node only ships from v22. On an
// older Node the SSR preview bundle throws
//   Error: Node.js detected but native WebSocket not found
// during module init, so `vite preview` answers HTTP 500 for every page and a
// Playwright run reports dozens of unrelated "real regressions". Failing up
// front with the actual cause is far cheaper to read than that cascade.
export const MINIMUM_NODE_MAJOR = 22;

export function nodeMajor(version = process.versions.node) {
  const major = Number.parseInt(String(version).split(".")[0], 10);
  return Number.isNaN(major) ? null : major;
}

export function nodeVersionError(version = process.versions.node, label = "ci") {
  const major = nodeMajor(version);
  if (major === null || major >= MINIMUM_NODE_MAJOR) return null;
  return (
    `[${label}] Node ${version} is below the required Node ${MINIMUM_NODE_MAJOR}.\n` +
    `[${label}] The backend client needs a native WebSocket (Node ${MINIMUM_NODE_MAJOR}+); ` +
    "without it every server-rendered page answers HTTP 500 and the whole suite fails.\n" +
    `[${label}] Use Node ${MINIMUM_NODE_MAJOR} or later (see .nvmrc; CI pins node-version: ${MINIMUM_NODE_MAJOR}).`
  );
}

/**
 * Throws when the current runtime is below the Node floor. Called at
 * playwright.config load time so a bad runtime fails before any browser,
 * preview server, or test file starts.
 */
export function assertNodeVersion(label = "ci") {
  const message = nodeVersionError(process.versions.node, label);
  if (message) throw new Error(message);
}
