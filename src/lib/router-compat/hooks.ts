/**
 * Router-compat hooks — v6-style hooks backed by @tanstack/react-router.
 */
import {
  useNavigate as tsNavigate,
  useLocation as tsLocation,
  useParams as tsParams,
  useRouter,
} from "@tanstack/react-router";
import { useMemo, useCallback, useContext } from "react";
import { parseTo, ShimParamsContext } from "./internal";

// ---------- useNavigate ----------

type NavigateOptions = { replace?: boolean; state?: unknown };

type NavigateFn = {
  (to: string | number, options?: NavigateOptions): void;
  (delta: number): void;
};

export function useNavigate(): NavigateFn {
  const tsNav = tsNavigate();
  const router = useRouter();
  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        router.history.go(to);
        return;
      }
      const { pathname, search, hash } = parseTo(to);
      tsNav({
        to: pathname,
        search: search as never,
        hash,
        state: options?.state as never,
        replace: options?.replace,
      });
    },
    [tsNav, router],
  ) as NavigateFn;
}

// ---------- useLocation ----------

export function useLocation() {
  const loc = tsLocation();
  return useMemo(
    () => ({
      pathname: loc.pathname,
      search: loc.searchStr ? `?${loc.searchStr}` : "",
      hash: loc.hash ?? "",
      state: (loc.state ?? null) as unknown,
      key: loc.pathname + (loc.searchStr ?? ""),
    }),
    [loc.pathname, loc.searchStr, loc.hash, loc.state],
  );
}

// ---------- useParams ----------

export function useParams<
  T extends Record<string, string | undefined> = Record<
    string,
    string | undefined
  >,
>(): T {
  const shimParams = useContext(ShimParamsContext);
  if (shimParams) return shimParams as T;
  return tsParams({ strict: false } as never) as T;
}

// ---------- useSearchParams (@/lib/router-compat compat) ----------

export function useSearchParams(): [
  URLSearchParams,
  (
    init:
      | URLSearchParams
      | Record<string, string>
      | ((prev: URLSearchParams) => URLSearchParams),
    opts?: { replace?: boolean },
  ) => void,
] {
  const loc = tsLocation();
  const nav = tsNavigate();
  const router = useRouter();
  const params = useMemo(
    () => new URLSearchParams(loc.searchStr ?? ""),
    [loc.searchStr],
  );
  const setParams = useCallback(
    (
      init:
        | URLSearchParams
        | Record<string, string>
        | ((prev: URLSearchParams) => URLSearchParams),
      opts?: { replace?: boolean },
    ) => {
      // Functional updaters read the router's live location, not the render
      // snapshot — react-router passes call-time params, and chained updates
      // within one tick must see each other's writes.
      const live = router.state.location;
      const current = new URLSearchParams(live.searchStr ?? "");
      const next =
        typeof init === "function"
          ? init(current)
          : init instanceof URLSearchParams
            ? init
            : new URLSearchParams(init);
      const searchObj: Record<string, string> = {};
      next.forEach((v, k) => {
        searchObj[k] = v;
      });
      nav({
        to: live.pathname,
        search: searchObj as never,
        replace: opts?.replace,
      });
    },
    [nav, router],
  );
  return [params, setParams];
}

// ---------- optional location (safe outside a router) ----------
// Some hooks watch the current route but are also rendered in isolation
// (tests, previews) where no router exists. Reading the location defensively
// keeps those surfaces working without a route to watch.
export function useOptionalLocationKey(): string | null {
  try {
    const loc = tsLocation();
    return `${loc.pathname ?? ""}${loc.searchStr ? `?${loc.searchStr}` : ""}`;
  } catch {
    return null;
  }
}
