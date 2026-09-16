import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PermissionEmptyStateProps {
  title: string;
  description: string;
  /** Optional technical detail, shown small and muted (e.g. the server message). */
  detail?: string | null;
}

/**
 * Shown instead of a blank panel when the signed-in user's role does not
 * allow reading the data a panel needs.
 */
const PermissionEmptyState = ({ title, description, detail }: PermissionEmptyStateProps) => (
  <Card>
    <CardContent className="py-10 text-center space-y-3">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted">
        <Lock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="text-base font-serif font-semibold text-foreground">{title}</h3>
      <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
      {detail && <p className="text-xs text-muted-foreground/70 break-words">{detail}</p>}
    </CardContent>
  </Card>
);

export default PermissionEmptyState;
