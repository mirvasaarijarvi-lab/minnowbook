import { useState } from "react";
import { Database, Check, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TenantBadgeProps {
  className?: string;
  compact?: boolean;
}

/**
 * Small debugging badge showing the current tenant_id.
 * Only visible to authorized staff (admins, owners, superadmins) to help verify RLS scoping.
 */
const TenantBadge = ({ className, compact = false }: TenantBadgeProps) => {
  const { tenantId, tenant, isAdmin } = useTenant();
  const { isSystemAdmin } = usePermissions();
  const [copied, setCopied] = useState(false);

  if (!tenantId || (!isAdmin && !isSystemAdmin)) return null;

  const shortId = tenantId.slice(0, 8);
  const tenantName = tenant?.name ?? "Unknown";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tenantId);
      setCopied(true);
      toast.success("Tenant ID copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy tenant ID ${tenantId}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs font-mono text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
            className,
          )}
        >
          <Database className="h-3 w-3 shrink-0" aria-hidden="true" />
          {!compact && <span className="hidden sm:inline truncate max-w-[120px]">{tenantName}</span>}
          <Badge variant="outline" className="font-mono text-[10px] py-0 px-1.5 leading-tight">
            {shortId}
          </Badge>
          {copied ? (
            <Check className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
          ) : (
            <Copy className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1 text-xs">
          <p className="font-semibold">Current tenant (RLS scope)</p>
          <p className="text-muted-foreground">{tenantName}</p>
          <p className="font-mono break-all">{tenantId}</p>
          <p className="text-muted-foreground italic">Click to copy · debug aid</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export default TenantBadge;
