import { createFileRoute } from "@tanstack/react-router";
import PublicBooking from "@/pages/PublicBooking";

export const Route = createFileRoute("/book/$slug")({
  component: PublicBooking,
});
