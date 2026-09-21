import { createFileRoute } from "@tanstack/react-router";
import DPA from "@/pages/legal/DPA";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/legal/dpa")({
  component: DPA,
  head: () =>
    routeHead({
      title: "Data Processing Agreement, MimmoBook",
      description:
        "MimmoBook's standard Data Processing Agreement (DPA) covering Article 28 GDPR obligations between MimmoBook as processor and the customer as controller.",
      path: "/legal/dpa",
      ogTitle: "MimmoBook Data Processing Agreement",
      ogDescription:
        "Our standard Article 28 GDPR terms for customers acting as controller.",
    }),
});
