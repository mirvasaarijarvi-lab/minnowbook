// Barrel so existing "@/lib/router-compat" imports keep working while hooks,
// components and internal helpers live in separate modules.
// See docs/linting-policy.md.
export {
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
  useOptionalLocationKey,
} from "./hooks";
export {
  Link,
  Navigate,
  Outlet,
  NavLink,
  MemoryRouter,
  Routes,
  Route,
  type NavLinkProps,
} from "./components";
