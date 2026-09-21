import { createFileRoute } from "@tanstack/react-router";
import Login from "@/pages/Login";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/login")({
  component: Login,
  head: () =>
    routeHead({
      title: "Log in to MimmoBook, Reservation Management",
      description:
        "Sign in to your MimmoBook account to manage reservations, sites, team and branded booking pages.",
      path: "/login",
      ogTitle: "Log in to MimmoBook",
      ogDescription: "Sign in to manage your reservations and booking pages.",
    }),
});
