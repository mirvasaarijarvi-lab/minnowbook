import { createFileRoute } from "@tanstack/react-router";
import Privacy from "@/pages/Privacy";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
  head: () =>
    routeHead({
      title: "Privacy Policy, MimmoBook",
      description:
        "Read MimmoBook's privacy policy. Learn how we collect, use and protect your data in compliance with GDPR and applicable data protection regulations.",
      path: "/privacy",
      ogTitle: "MimmoBook privacy policy",
      ogDescription:
        "How we collect, use and protect personal data, in line with GDPR.",
    }),
});
