import { createFileRoute } from "@tanstack/react-router";
import Subprocessors from "@/pages/legal/Subprocessors";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/legal/subprocessors")({
  component: Subprocessors,
  head: () =>
    routeHead({
      title: "Subprocessor Inventory, MimmoBook",
      description:
        "Complete list of the third-party processors MimmoBook uses to operate the service, including purpose, data categories and processing region.",
      path: "/legal/subprocessors",
      ogTitle: "MimmoBook subprocessors",
      ogDescription:
        "Every third-party processor we rely on, what it does and where it processes data.",
    }),
});
