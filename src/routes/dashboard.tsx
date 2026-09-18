import { createFileRoute } from "@tanstack/react-router";
import Dashboard from "@/pages/Dashboard";
import ProtectedRoute from "@/components/ProtectedRoute";
import RequireTenant from "@/components/RequireTenant";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <ProtectedRoute>
      <RequireTenant inline attemptedArea="dashboard">
        <Dashboard />
      </RequireTenant>
    </ProtectedRoute>
  ),
});
