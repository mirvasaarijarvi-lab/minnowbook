import { createFileRoute } from "@tanstack/react-router";
import Blog from "@/pages/Blog";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/blog/")({
  component: Blog,
  head: () =>
    routeHead({
      title: "Blog, Booking Guides for Service Pros and Hospitality",
      description:
        "Booking guides for barbers, hairdressers, massage therapists, bakers, personal trainers, restaurants, venues and hotels: fill your calendar and cut no-shows.",
      path: "/blog",
      ogTitle: "MimmoBook Blog, guides for fuller calendars",
      ogDescription:
        "Practical booking guides for service professionals and hospitality businesses.",
    }),
});
