import { createFileRoute } from "@tanstack/react-router";
import BlogJsonLdPreview from "@/pages/BlogJsonLdPreview";
import ProtectedRoute from "@/components/ProtectedRoute";
import SystemAdminRoute from "@/components/SystemAdminRoute";

export const Route = createFileRoute("/superadmin/blog-json-ld")({
  component: () => (
    <ProtectedRoute>
      <SystemAdminRoute
        attemptedArea="the blog JSON-LD preview"
        areaSlug="superadmin"
      >
        <BlogJsonLdPreview />
      </SystemAdminRoute>
    </ProtectedRoute>
  ),
});
