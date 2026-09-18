import { createFileRoute } from "@tanstack/react-router";
import GaValidate from "@/pages/GaValidate";
import ProtectedRoute from "@/components/ProtectedRoute";
import SystemAdminRoute from "@/components/SystemAdminRoute";

export const Route = createFileRoute("/superadmin/ga-validate")({
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
