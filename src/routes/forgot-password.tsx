import { createFileRoute } from "@tanstack/react-router";
import { routeHead } from "@/lib/route-head";
import ForgotPassword from "@/pages/ForgotPassword";

export const Route = createFileRoute("/forgot-password")({
  head: () =>
    routeHead({
      title: "Forgot Password, MimmoBook",
      description: "Request a secure link to reset your MimmoBook account password.",
      path: "/forgot-password",
      noindex: true,
    }),
  component: ForgotPassword,
});
