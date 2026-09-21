/**
 * Router-compat components — v6-style components backed by
 * @tanstack/react-router. This module exports components only.
 */
import {
  Link as TSLink,
  Navigate as TSNavigate,
  Outlet as TSOutlet,
  useLocation as tsLocation,
  RouterContextProvider,
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
} from "@tanstack/react-router";
import {
  useMemo,
  useRef,
  useContext,
  createContext,
  Children,
  isValidElement,
  forwardRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  parseTo,
  matchPath,
  ShimParamsContext,
  type ShimRouteProps,
} from "./internal";
import { useLocation } from "./hooks";

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

export function Route(_props: ShimRouteProps): null {
  return null;
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
