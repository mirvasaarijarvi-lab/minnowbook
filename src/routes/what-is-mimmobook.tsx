import { createFileRoute } from "@tanstack/react-router";
import WhatIsMimmobook from "@/pages/WhatIsMimmobook";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/what-is-mimmobook")({
  component: WhatIsMimmobook,
  head: () =>
    routeHead({
      title: "What Is MimmoBook? Booking for Service Pros and Hospitality",
      description:
        "MimmoBook is a cloud booking platform for barbers, hairdressers, massage therapists, bakers, personal trainers, restaurants, venues, hotels and guesthouses.",
      path: "/what-is-mimmobook",
      ogTitle: "What is MimmoBook?",
      ogDescription:
        "A cloud booking platform for service professionals and hospitality, with branded booking pages and automated guest emails.",
    }),
});
