import { createFileRoute } from "@tanstack/react-router";
import UseCases from "@/pages/UseCases";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/use-cases")({
  component: UseCases,
  head: () =>
    routeHead({
      title: "Use Cases, Barbers, Salons, Massage, Bakeries and Venues",
      description:
        "See how MimmoBook works for barbers, hairdressers, massage therapists, bakers, personal trainers, make-up artists, restaurants, venues, hotels, guesthouses, catering and pop-ups.",
      path: "/use-cases",
      ogTitle:
        "Booking software for barbers, salons, massage, bakeries and trainers",
      ogDescription:
        "Service professionals: take bookings around the clock, run a waiting list, price your services, send reminders and collect reviews. Restaurants, venues and hotels too.",
      image: "https://mimmobook.com/og/use-cases-en.png",
      imageAlt: "MimmoBook use cases for service professionals and hospitality",
    }),
});
