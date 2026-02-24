import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TourStep {
  /** CSS selector to highlight */
  target: string;
  /** Title shown in the tooltip */
  title: string;
  /** Description text */
  content: string;
  /** Position of the tooltip relative to the target */
  placement?: "top" | "bottom" | "left" | "right";
  /** Dashboard view this step belongs to — triggers navigation if provided */
  view?: string;
}

interface GuidedTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  /** Called when the tour finishes all steps */
  onComplete?: () => void;
  /** Called when a step requires navigating to a different view */
  onNavigate?: (view: string) => void;
}

const PADDING = 8;
const TOOLTIP_GAP = 12;

const GuidedTour = ({ steps, isOpen, onClose, onComplete, onNavigate }: GuidedTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [spotlightStyle, setSpotlightStyle] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];

  const positionTooltip = useCallback(() => {
    if (!step || !isOpen) return;

    const el = document.querySelector(step.target);
    if (!el) {
      // Element not found — try to position center
      setSpotlightStyle({ display: "none" });
      setTooltipStyle({
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      });
      return;
    }

    const rect = el.getBoundingClientRect();
    setSpotlightStyle({
      position: "fixed",
      top: rect.top - PADDING,
      left: rect.left - PADDING,
      width: rect.width + PADDING * 2,
      height: rect.height + PADDING * 2,
      borderRadius: "8px",
      display: "block",
    });

    // Scroll element into view if needed
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const placement = step.placement || "bottom";
    const style: React.CSSProperties = { position: "fixed" };

    switch (placement) {
      case "bottom":
        style.top = rect.bottom + TOOLTIP_GAP;
        style.left = rect.left + rect.width / 2;
        style.transform = "translateX(-50%)";
        break;
      case "top":
        style.bottom = window.innerHeight - rect.top + TOOLTIP_GAP;
        style.left = rect.left + rect.width / 2;
        style.transform = "translateX(-50%)";
        break;
      case "right":
        style.top = rect.top + rect.height / 2;
        style.left = rect.right + TOOLTIP_GAP;
        style.transform = "translateY(-50%)";
        break;
      case "left":
        style.top = rect.top + rect.height / 2;
        style.right = window.innerWidth - rect.left + TOOLTIP_GAP;
        style.transform = "translateY(-50%)";
        break;
    }

    setTooltipStyle(style);
  }, [step, isOpen]);

  // Navigate to the correct view when the step changes
  useEffect(() => {
    if (!isOpen || !step?.view) return;
    onNavigate?.(step.view);
  }, [isOpen, currentStep]);

  // Position tooltip after a short delay to allow view to render
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(positionTooltip, 150);

    const handleResize = () => positionTooltip();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [isOpen, currentStep, positionTooltip]);

  // Reset step on open
  useEffect(() => {
    if (isOpen) setCurrentStep(0);
  }, [isOpen]);

  if (!isOpen || !step) return null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete?.();
      onClose();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) setCurrentStep((s) => s - 1);
  };

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 transition-opacity duration-300" onClick={onClose} />

      {/* Spotlight cutout */}
      <div
        className="absolute z-[10000] pointer-events-none transition-all duration-300"
        style={{
          ...spotlightStyle,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
          background: "transparent",
        }}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="z-[10001] w-[320px] max-w-[calc(100vw-32px)] rounded-xl border border-border bg-card shadow-hero p-4 animate-scale-in"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-serif font-semibold text-foreground text-sm leading-tight pr-6">
            {step.title}
          </h3>
          <button
            onClick={onClose}
            className="shrink-0 p-0.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {step.content}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {currentStep + 1} / {steps.length}
          </span>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={handlePrev} className="gap-1 h-8 px-2.5">
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
            <Button variant="default" size="sm" onClick={handleNext} className="gap-1 h-8 px-3">
              {isLast ? "Finish" : "Next"}
              {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mt-3">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                i === currentStep ? "w-4 bg-accent" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default GuidedTour;
