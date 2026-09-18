import { createFileRoute } from "@tanstack/react-router";
import DPA from "@/pages/legal/DPA";

export const Route = createFileRoute("/legal/dpa")({
  component: DPA,
});
