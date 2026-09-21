import { createFileRoute } from "@tanstack/react-router";
import FindBooking from "@/pages/FindBooking";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/find-booking")({
  component: FindBooking,
  head: () =>
    routeHead({
      title: "Find Your Booking, MimmoBook",
      description:
        "Enter your email to receive a secure link to view, change or cancel your upcoming reservation.",
      path: "/find-booking",
      ogTitle: "Find your booking",
      ogDescription:
        "Get a secure link to view, change or cancel your reservation.",
      noindex: true,
    }),
});
