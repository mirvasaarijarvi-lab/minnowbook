import { createFileRoute } from "@tanstack/react-router";
import FindBooking from "@/pages/FindBooking";

export const Route = createFileRoute("/find-booking")({
  component: FindBooking,
});
