import { createFileRoute } from "@tanstack/react-router";
import EmailPreviewSmoke from "@/pages/EmailPreviewSmoke";

export const Route = createFileRoute("/e2e/email-preview")({
  component: EmailPreviewSmoke,
});
