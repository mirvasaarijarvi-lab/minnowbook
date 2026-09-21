import { createFileRoute } from "@tanstack/react-router";
import Pricing from "@/pages/Pricing";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/pricing")({
  component: Pricing,
  head: () =>
    routeHead({
      title: "MimmoBook Pricing, Plans from 19 EUR per month (VAT included)",
      description:
        "Compare MimmoBook plans: Basic 19 EUR, Professional 59 EUR, Business 179 EUR per month (VAT included) and Enterprise by offer. 30-day free trial and branded booking pages.",
      path: "/pricing",
      ogTitle: "MimmoBook pricing, simple plans with no booking commission",
      ogDescription:
        "Four plans for every size of business, VAT included, with a 30-day free trial and branded booking pages on every plan.",
    }),
});
