import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useT } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  /** Optional count shown as a badge next to the title. */
  count?: number;
  /** Optional extra nodes rendered next to the title (icons, tooltips). */
  titleExtra?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Collapsible wrapper for long report lists so charts and cards stay readable.
 * Collapsed by default; state is local to the section.
 */
const CollapsibleSection = ({
  title,
  count,
  titleExtra,
  defaultOpen = false,
  className,
  children,
}: CollapsibleSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const t = useT();

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("min-w-0", className)}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-1 py-2 text-left transition-colors hover:bg-muted/50">
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
        <span className="text-sm font-medium">{title}</span>
        {typeof count === "number" && <Badge variant="secondary">{count}</Badge>}
        {titleExtra}
        <span className="ml-auto text-xs text-muted-foreground">
          {open ? t("common.hideList") : t("common.showList")}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
};

export default CollapsibleSection;
