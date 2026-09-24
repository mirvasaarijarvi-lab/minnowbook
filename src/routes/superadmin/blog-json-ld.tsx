import { createFileRoute } from "@tanstack/react-router";
import { routeHead } from "@/lib/route-head";
import BlogJsonLdPreview from "@/pages/BlogJsonLdPreview";
import ProtectedRoute from "@/components/ProtectedRoute";
import SystemAdminRoute from "@/components/SystemAdminRoute";

export const Route = createFileRoute("/superadmin/blog-json-ld")({
  head: () =>
    routeHead({
      title: "Blog Structured Data, MimmoBook Admin",
      description: "Internal structured data preview for blog posts.",
      path: "/superadmin/blog-json-ld",
      noindex: true,
    }),
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
