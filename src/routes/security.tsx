import { createFileRoute } from "@tanstack/react-router";
import Security from "@/pages/Security";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/security")({
  component: Security,
  head: () =>
    routeHead({
      title: "Security and Responsible Disclosure, MimmoBook",
      description:
        "MimmoBook's security program, secure development practices, and how to report a vulnerability under our responsible disclosure policy.",
      path: "/security",
      ogTitle: "Security at MimmoBook",
      ogDescription:
        "How we protect reservation data, and how to report a vulnerability responsibly.",
    }),
});
