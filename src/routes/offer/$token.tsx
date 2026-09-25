import { createFileRoute } from "@tanstack/react-router";
import { routeHead } from "@/lib/route-head";
import GuestOfferPage from "@/pages/GuestOfferPage";

export const Route = createFileRoute("/offer/$token")({
  head: () =>
    routeHead({
      title: "Your Offer, MimmoBook",
      description: "Review the offer prepared for you and accept it.",
      path: "/offer",
      noindex: true,
    }),
  component: GuestOfferPage,
});
