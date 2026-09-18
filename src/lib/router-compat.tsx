/**
 * Router-compat shim — bridges @/lib/router-compat v6 call sites to
 * @tanstack/react-router without hand-rewriting every component.
 */
import {
  useNavigate as tsNavigate,
  useLocation as tsLocation,
  useParams as tsParams,
  useRouter,
  Link as TSLink,
  Navigate as TSNavigate,
  Outlet as TSOutlet,
  RouterProvider,
  RouterContextProvider,
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
} from "@tanstack/react-router";
import {
  useMemo,
  useCallback,
  useRef,
  useContext,
  createContext,
  Children,
  isValidElement,
  forwardRef,
  type ComponentProps,
  type ReactNode,
} from "react";

// ---------- shared URL parsing ----------

function parseTo(to: string): {
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

// ---------- Link ----------

type LinkProps = Omit<ComponentProps<typeof TSLink>, "to"> & {
  to: string;
  replace?: boolean;
  state?: unknown;
  children?: ReactNode;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, replace, state, children, ...rest },
  ref,
) {
  const { pathname, search, hash } = parseTo(to);
  return (
    <TSLink
      ref={ref as never}
      to={pathname as never}
      search={search as never}
      hash={hash}
      replace={replace}
      state={state as never}
      {...((rest ?? {}) as Record<string, unknown>)}
    >
      {children}
    </TSLink>
  );
});

// ---------- Navigate ----------

export function Navigate({
  to,
  replace,
  state,
}: {
  to: string;
  replace?: boolean;
  state?: unknown;
}) {
  const { pathname, search, hash } = parseTo(to);
  return (
    <TSNavigate
      to={pathname as never}
      search={search as never}
      hash={hash}
      state={state as never}
      replace={replace}
    />
  );
}

// ---------- Outlet ----------

export const Outlet = TSOutlet;

// ---------- NavLink ----------

type NavLinkRenderState = {
  isActive: boolean;
  isPending: boolean;
  isTransitioning: boolean;
};

export type NavLinkProps = Omit<
  LinkProps,
  "className" | "style" | "children"
> & {
  className?: string | ((state: NavLinkRenderState) => string);
  style?:
    | React.CSSProperties
    | ((state: NavLinkRenderState) => React.CSSProperties | undefined);
  children?: ReactNode | ((state: NavLinkRenderState) => ReactNode);
  end?: boolean;
};

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  function NavLink({ className, style, children, end, to, ...rest }, ref) {
    const loc = tsLocation();
    const target = parseTo(to).pathname;
    const current = loc.pathname;
    const isActive = end
      ? current === target
      : current === target ||
        current.startsWith(target.endsWith("/") ? target : `${target}/`);
    const state: NavLinkRenderState = {
      isActive,
      isPending: false,
      isTransitioning: false,
    };
    return (
      <Link
        ref={ref}
        to={to}
        className={
          typeof className === "function" ? className(state) : className
        }
        style={typeof style === "function" ? style(state) : style}
        aria-current={isActive ? "page" : undefined}
        {...(rest as Record<string, unknown>)}
      >
        {typeof children === "function" ? children(state) : children}
      </Link>
    );
  },
);

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

// ---------- MemoryRouter (tests / isolated previews) ----------
// Renders arbitrary children inside a real in-memory TanStack router so
// components that use Link, useLocation or useNavigate work without the
// generated app route tree.

const MemoryChildrenContext = createContext<ReactNode>(null);

function MemoryChildrenSlot() {
  return <>{useContext(MemoryChildrenContext)}</>;
}

export function MemoryRouter({
  children,
  initialEntries,
}: {
  children?: ReactNode;
  initialEntries?: string[];
}) {
  const initialRef = useRef(initialEntries);
  const router = useMemo(() => {
    const rootRoute = createRootRoute({ component: MemoryChildrenSlot });
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: () => null,
    });
    const splatRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/$",
      component: () => null,
    });
    rootRoute.addChildren([indexRoute, splatRoute]);
    return createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory({
        initialEntries: initialRef.current?.length ? initialRef.current : ["/"],
      }),
    });
  }, []);

  return (
    <RouterContextProvider router={router as never}>
      {children}
    </RouterContextProvider>
  );
}

// ---------- Routes / Route (v6-style flat matching) ----------
// Used by tests and isolated harnesses that render a small route table
// instead of the generated app route tree.

const ShimParamsContext = createContext<Record<string, string> | null>(null);

type ShimRouteProps = {
  path?: string;
  element?: ReactNode;
  index?: boolean;
  children?: ReactNode;
};

export function Route(_props: ShimRouteProps): null {
  return null;
}

function matchPath(
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

export function Routes({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  let best: {
    element: ReactNode;
    params: Record<string, string>;
    score: number;
  } | null = null;

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as ShimRouteProps;
    const pattern = props.index ? "/" : (props.path ?? "/");
    const match = matchPath(pattern, pathname);
    if (!match) return;
    if (!best || match.score > best.score) {
      best = {
        element: props.element ?? null,
        params: match.params,
        score: match.score,
      };
    }
  });

  if (!best) return null;
  const matched = best as {
    element: ReactNode;
    params: Record<string, string>;
  };
  return (
    <ShimParamsContext.Provider value={matched.params}>
      {matched.element}
    </ShimParamsContext.Provider>
  );
}
