import { createFileRoute } from "@tanstack/react-router";
import Accessibility from "@/pages/Accessibility";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/accessibility")({
  component: Accessibility,
  head: () =>
    routeHead({
      title: "Accessibility Statement, MimmoBook",
      description:
        "MimmoBook's accessibility commitment. Learn about our WCAG compliance, keyboard navigation, screen reader support and accessibility features.",
      path: "/accessibility",
      ogTitle: "Accessibility at MimmoBook",
      ogDescription:
        "Our WCAG commitment, keyboard navigation and screen reader support.",
    }),
});
