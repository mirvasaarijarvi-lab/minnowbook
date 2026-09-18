import { createFileRoute } from "@tanstack/react-router";
import GaDebug from "@/pages/GaDebug";
import ProtectedRoute from "@/components/ProtectedRoute";
import SystemAdminRoute from "@/components/SystemAdminRoute";

export const Route = createFileRoute("/superadmin/ga-debug")({
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
