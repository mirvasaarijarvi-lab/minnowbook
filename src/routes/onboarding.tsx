import { createFileRoute } from "@tanstack/react-router";
import Onboarding from "@/pages/Onboarding";
import ProtectedRoute from "@/components/ProtectedRoute";

export const Route = createFileRoute("/onboarding")({
  component: () => (
    <ProtectedRoute>
      <Onboarding />
    </ProtectedRoute>
  ),
});
