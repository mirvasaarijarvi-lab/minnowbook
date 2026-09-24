import { createFileRoute } from "@tanstack/react-router";
import { routeHead } from "@/lib/route-head";
import GuestPortal from "@/pages/GuestPortal";

export const Route = createFileRoute("/my-booking/$token")({
  head: () =>
    routeHead({
      title: "My Booking, MimmoBook",
      description: "View, change or cancel your booking.",
      path: "/my-booking",
      noindex: true,
    }),
  component: GuestPortal,
});
