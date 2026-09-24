import { createFileRoute } from "@tanstack/react-router";
import { routeHead } from "@/lib/route-head";
import Onboarding from "@/pages/Onboarding";
import ProtectedRoute from "@/components/ProtectedRoute";

export const Route = createFileRoute("/onboarding")({
  head: () =>
    routeHead({
      title: "Set Up Your Business, MimmoBook",
      description: "Set up your business, sites and bookable resources in MimmoBook.",
      path: "/onboarding",
      noindex: true,
    }),
  component: () => (
    <ProtectedRoute>
      <Onboarding />
    </ProtectedRoute>
  ),
});
