import { createFileRoute } from "@tanstack/react-router";
import { routeHead } from "@/lib/route-head";
import PublicBooking from "@/pages/PublicBooking";

export const Route = createFileRoute("/book/$slug")({
  head: ({ params }) =>
    routeHead({
      title: "Book Online, MimmoBook",
      description:
        "Check availability and book your table, room, appointment or service online in a few steps. Secure booking powered by MimmoBook.",
      path: `/book/${params.slug}`,
      ogTitle: "Book online",
      ogDescription: "Check availability and make your booking online.",
    }),
  component: PublicBooking,
});
