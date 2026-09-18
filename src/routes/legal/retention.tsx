import { createFileRoute } from "@tanstack/react-router";
import Retention from "@/pages/legal/Retention";

export const Route = createFileRoute("/legal/retention")({
  component: Retention,
});
