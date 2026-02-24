import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface DashboardTooltipProps {
  text: string;
  className?: string;
}

/**
 * Small help icon with tooltip, used for contextual guidance throughout the dashboard.
 */
const DashboardTooltip = ({ text, className }: DashboardTooltipProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors ${className ?? ""}`}
        aria-label="Help"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
      {text}
    </TooltipContent>
  </Tooltip>
);

export default DashboardTooltip;
