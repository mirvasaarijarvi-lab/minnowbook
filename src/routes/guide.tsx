import { createFileRoute } from "@tanstack/react-router";
import StaffGuide from "@/pages/StaffGuide";
import ProtectedRoute from "@/components/ProtectedRoute";
import RequireTenant from "@/components/RequireTenant";

export const Route = createFileRoute("/guide")({
  component: () => (
    <ProtectedRoute>
      <RequireTenant inline attemptedArea="generic">
        <StaffGuide />
      </RequireTenant>
    </ProtectedRoute>
  ),
});
