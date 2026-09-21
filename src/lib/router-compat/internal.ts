/**
 * Internal helpers shared by the router-compat hooks and components.
 * Kept separate so component modules only export components
 * (see docs/linting-policy.md).
 */
import { createContext, type ReactNode } from "react";

// ---------- shared URL parsing ----------

export function parseTo(to: string): {
  pathname: string;
  search?: Record<string, string>;
  hash?: string;
} {
  const [beforeHash, hashStr] = (to ?? "").split("#");
  const [pathname, searchStr] = beforeHash.split("?");
  return {
    // react-router keeps the current path for search-only ("?a=1") and
    // hash-only ("#section") targets; TanStack's "." means current route.
    pathname: pathname || ".",
    search: searchStr
      ? Object.fromEntries(new URLSearchParams(searchStr))
      : undefined,
    hash: hashStr || undefined,
  };
}

export const ShimParamsContext = createContext<Record<string, string> | null>(
  null,
);

export type ShimRouteProps = {
  path?: string;
  element?: ReactNode;
  index?: boolean;
  children?: ReactNode;
};

export function matchPath(
  pattern: string,
  pathname: string,
): { score: number; params: Record<string, string> } | null {
  const pSegs = pattern.replace(/^\//, "").split("/").filter(Boolean);
  const aSegs = pathname.replace(/^\//, "").split("/").filter(Boolean);
  const params: Record<string, string> = {};
  let score = 0;
  for (let i = 0; i < pSegs.length; i += 1) {
    const seg = pSegs[i];
    if (seg === "*") return { score, params };
    const actual = aSegs[i];
    if (actual === undefined) return null;
    if (seg.startsWith(":")) {
      params[seg.slice(1)] = decodeURIComponent(actual);
      score += 1;
    } else if (seg === actual) {
      score += 2;
    } else {
      return null;
    }
  }
  if (aSegs.length !== pSegs.length) return null;
  return { score, params };
}
