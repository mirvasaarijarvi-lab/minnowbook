import { createFileRoute } from "@tanstack/react-router";
import { routeHead } from "@/lib/route-head";
import ResetPassword from "@/pages/ResetPassword";

export const Route = createFileRoute("/reset-password")({
  head: () =>
    routeHead({
      title: "Reset Password, MimmoBook",
      description: "Choose a new password for your MimmoBook account.",
      path: "/reset-password",
      noindex: true,
    }),
  component: ResetPassword,
});
