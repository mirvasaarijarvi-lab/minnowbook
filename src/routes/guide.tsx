import { createFileRoute } from "@tanstack/react-router";
import { routeHead } from "@/lib/route-head";
import StaffGuide from "@/pages/StaffGuide";
import ProtectedRoute from "@/components/ProtectedRoute";
import RequireTenant from "@/components/RequireTenant";

export const Route = createFileRoute("/guide")({
  head: () =>
    routeHead({
      title: "Staff Quick Guide, MimmoBook",
      description: "Step by step guide for staff on managing reservations, sites and reports in MimmoBook.",
      path: "/guide",
      noindex: true,
    }),
  component: () => (
    <ProtectedRoute>
      <RequireTenant inline attemptedArea="generic">
        <StaffGuide />
      </RequireTenant>
    </ProtectedRoute>
  ),
});
