import { createFileRoute } from "@tanstack/react-router";
import GuestPortal from "@/pages/GuestPortal";

export const Route = createFileRoute("/my-booking/$token")({
  component: GuestPortal,
});
