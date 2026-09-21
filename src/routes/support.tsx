import { createFileRoute } from "@tanstack/react-router";
import Support from "@/pages/Support";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/support")({
  component: Support,
  head: () =>
    routeHead({
      title: "MimmoBook Support, Help Center and Knowledge Base",
      description:
        "Find answers to common questions about MimmoBook reservation management. Browse help articles on setup, bookings, email templates, team management and billing.",
      path: "/support",
      ogTitle: "MimmoBook support and help center",
      ogDescription:
        "Guides and answers for setup, bookings, guest emails, team management and billing.",
    }),
});
