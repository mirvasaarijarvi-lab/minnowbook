import { cva } from "class-variance-authority";

// Kept in a non-component module so `navigation-menu.tsx` only exports
// components and React Fast Refresh keeps working for it.
// See docs/linting-policy.md.
export const navigationMenuTriggerStyle = cva(
  "group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50",
);
