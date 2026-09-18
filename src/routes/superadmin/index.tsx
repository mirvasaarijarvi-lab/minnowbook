import { createFileRoute } from "@tanstack/react-router";
import Superadmin from "@/pages/Superadmin";
import ProtectedRoute from "@/components/ProtectedRoute";
import SystemAdminRoute from "@/components/SystemAdminRoute";

export const Route = createFileRoute("/superadmin/")({
  component: () => (
    <ProtectedRoute>
      <SystemAdminRoute
        attemptedArea="the Superadmin area"
        areaSlug="superadmin"
      >
        <Superadmin />
      </SystemAdminRoute>
    </ProtectedRoute>
  ),
});
