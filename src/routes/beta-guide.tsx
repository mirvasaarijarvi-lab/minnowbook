import { createFileRoute } from "@tanstack/react-router";
import BetaGuide from "@/pages/BetaGuide";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/beta-guide")({
  component: BetaGuide,
  head: () =>
    routeHead({
      title: "Beta Tester Guide, MimmoBook",
      description:
        "Welcome to the MimmoBook beta program. Learn how to redeem your access code and get started with your first bookings.",
      path: "/beta-guide",
      ogTitle: "MimmoBook beta tester guide",
      ogDescription:
        "Redeem your access code and set up your first branded booking page.",
    }),
});
