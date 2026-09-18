import { createFileRoute } from "@tanstack/react-router";
import Accessibility from "@/pages/Accessibility";

export const Route = createFileRoute("/accessibility")({
  component: Accessibility,
});
