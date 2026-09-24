import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/")({
  component: Index,
  head: () =>
    routeHead({
      title: "MimmoBook, Booking Software for Service Pros & Hospitality",
      description:
        "Online booking for barbers, hairdressers, massage therapists, bakers, personal trainers, restaurants, venues and hotels. Branded booking pages and automated emails.",
      path: "/",
      ogTitle: "MimmoBook, Reservations for Hospitality & Wellness",
      ogDescription:
        "Cloud reservations for restaurants, venues, hotels, guesthouses, wellness and service businesses. Multi-site with branded booking pages.",
      image: "https://mimmobook.com/og-share.jpg",
      imageAlt: "MimmoBook booking software for hospitality and service pros",
    }),
});
