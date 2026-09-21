import { createFileRoute } from "@tanstack/react-router";
import Features from "@/pages/Features";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/features")({
  component: Features,
  head: () =>
    routeHead({
      title: "Features, Online Booking for Service Pros and Hospitality",
      description:
        "Branded booking pages, automated reminders, team management, reports and multi-site support for barbers, hairdressers, massage therapists, bakers, personal trainers and venues.",
      path: "/features",
      ogTitle: "Everything MimmoBook does for your bookings",
      ogDescription:
        "Branded booking pages, automated reminders, team roles, reports and multi-site management in one place.",
    }),
});
