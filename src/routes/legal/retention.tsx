import { createFileRoute } from "@tanstack/react-router";
import Retention from "@/pages/legal/Retention";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/legal/retention")({
  component: Retention,
  head: () =>
    routeHead({
      title: "Data Retention Schedule, MimmoBook",
      description:
        "How long MimmoBook keeps each category of data, in line with GDPR data minimisation and storage limitation principles.",
      path: "/legal/retention",
      ogTitle: "MimmoBook data retention schedule",
      ogDescription:
        "Retention periods for every category of data we process, and when it is deleted.",
    }),
});
