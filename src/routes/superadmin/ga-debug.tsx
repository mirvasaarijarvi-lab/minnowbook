import { createFileRoute } from "@tanstack/react-router";
import { routeHead } from "@/lib/route-head";
import GaDebug from "@/pages/GaDebug";
import ProtectedRoute from "@/components/ProtectedRoute";
import SystemAdminRoute from "@/components/SystemAdminRoute";

export const Route = createFileRoute("/superadmin/ga-debug")({
  head: () =>
    routeHead({
      title: "Analytics Debug, MimmoBook Admin",
      description: "Internal analytics debugging tool.",
      path: "/superadmin/ga-debug",
      noindex: true,
    }),
  component: () => (
    <ProtectedRoute>
      <SystemAdminRoute
        attemptedArea="the GA4 diagnostics panel"
        areaSlug="superadmin"
      >
        <GaDebug />
      </SystemAdminRoute>
    </ProtectedRoute>
  ),
});
