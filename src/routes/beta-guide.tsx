import { createFileRoute } from "@tanstack/react-router";
import BetaGuide from "@/pages/BetaGuide";

export const Route = createFileRoute("/beta-guide")({
  component: BetaGuide,
});
