import { createFileRoute } from "@tanstack/react-router";
import { routeHead } from "@/lib/route-head";
import Superadmin from "@/pages/Superadmin";
import ProtectedRoute from "@/components/ProtectedRoute";
import SystemAdminRoute from "@/components/SystemAdminRoute";

export const Route = createFileRoute("/superadmin/")({
  head: () =>
    routeHead({
      title: "Platform Admin, MimmoBook",
      description: "Platform administration for MimmoBook.",
      path: "/superadmin",
      noindex: true,
    }),
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
