import { createFileRoute } from "@tanstack/react-router";
import { routeHead } from "@/lib/route-head";
import EmailPreviewSmoke from "@/pages/EmailPreviewSmoke";

export const Route = createFileRoute("/e2e/email-preview")({
  head: () =>
    routeHead({
      title: "Email Preview, MimmoBook",
      description: "Internal preview of MimmoBook guest emails.",
      path: "/e2e/email-preview",
      noindex: true,
    }),
  component: EmailPreviewSmoke,
});
