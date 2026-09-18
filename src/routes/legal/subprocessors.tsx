import { createFileRoute } from "@tanstack/react-router";
import Subprocessors from "@/pages/legal/Subprocessors";

export const Route = createFileRoute("/legal/subprocessors")({
  component: Subprocessors,
});
