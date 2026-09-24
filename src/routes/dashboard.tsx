import { createFileRoute } from "@tanstack/react-router";
import { routeHead } from "@/lib/route-head";
import Dashboard from "@/pages/Dashboard";
import ProtectedRoute from "@/components/ProtectedRoute";
import RequireTenant from "@/components/RequireTenant";

export const Route = createFileRoute("/dashboard")({
  head: () =>
    routeHead({
      title: "Dashboard, MimmoBook",
      description: "Manage reservations, resources, sites, team and reports for your business.",
      path: "/dashboard",
      noindex: true,
    }),
  component: () => (
    <ProtectedRoute>
      <RequireTenant inline attemptedArea="dashboard">
        <Dashboard />
      </RequireTenant>
    </ProtectedRoute>
  ),
});
