import * as React from "react";

import { cn } from "@/lib/utils";
import {
  badgeVariants,
  type BadgeVariantProps,
} from "@/components/ui/badge-variants";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, BadgeVariantProps {}

// forwardRef so consumers (Radix Slot via `asChild`, Tooltip triggers, etc.)
// can attach a ref without React logging
// "Function components cannot be given refs."
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  ),
);
Badge.displayName = "Badge";

export { Badge };
