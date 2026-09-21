import { createFileRoute } from "@tanstack/react-router";
import Signup from "@/pages/Signup";
import { routeHead } from "@/lib/route-head";

export const Route = createFileRoute("/signup")({
  component: Signup,
  head: () =>
    routeHead({
      title: "Sign up for MimmoBook, Start Your Free Trial",
      description:
        "Create your MimmoBook account and start a 30-day free trial. Branded booking pages, multi-site support and automated guest emails.",
      path: "/signup",
      ogTitle: "Start your 30-day MimmoBook trial",
      ogDescription:
        "Create an account and take your first online bookings today.",
    }),
});
