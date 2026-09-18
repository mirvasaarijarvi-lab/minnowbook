import { createFileRoute } from "@tanstack/react-router";
import WhatIsMimmobook from "@/pages/WhatIsMimmobook";

export const Route = createFileRoute("/what-is-mimmobook")({
  component: WhatIsMimmobook,
});
