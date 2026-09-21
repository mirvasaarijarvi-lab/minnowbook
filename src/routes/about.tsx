import { createFileRoute } from "@tanstack/react-router";
import About from "@/pages/About";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/about")({
  component: About,
  head: () =>
    routeHead({
      title: "About MimmoBook, Our Mission and Values",
      description:
        "Learn about MimmoBook, the reservation platform for restaurants, venues, hotels, guesthouses and wellness pros. Our mission: simpler bookings for all.",
      path: "/about",
      ogTitle: "About MimmoBook",
      ogDescription:
        "Why we built a reservation platform for small hospitality and service businesses, and what we stand for.",
    }),
});
