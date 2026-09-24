import { createFileRoute } from "@tanstack/react-router";
import { routeHead } from "@/lib/route-head";
import GaValidate from "@/pages/GaValidate";
import ProtectedRoute from "@/components/ProtectedRoute";
import SystemAdminRoute from "@/components/SystemAdminRoute";

export const Route = createFileRoute("/superadmin/ga-validate")({
  head: () =>
    routeHead({
      title: "Analytics Validation, MimmoBook Admin",
      description: "Internal analytics validation tool.",
      path: "/superadmin/ga-validate",
      noindex: true,
    }),
  component: () => (
    <ProtectedRoute>
      <SystemAdminRoute
        attemptedArea="the GA4 event validation panel"
        areaSlug="superadmin"
      >
        <GaValidate />
      </SystemAdminRoute>
    </ProtectedRoute>
  ),
});
