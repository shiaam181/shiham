import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success: "border-transparent bg-success text-success-foreground",
        warning: "border-transparent bg-warning text-warning-foreground",
        info: "border-transparent bg-info text-info-foreground",
        "success-soft": "border-success/20 bg-success-soft text-success",
        "warning-soft": "border-warning/20 bg-warning-soft text-warning",
        "destructive-soft": "border-destructive/20 bg-destructive-soft text-destructive",
        "info-soft": "border-info/20 bg-info-soft text-info",
        present: "border-success/20 bg-success-soft text-success font-medium",
        absent: "border-destructive/20 bg-destructive-soft text-destructive font-medium",
        leave: "border-info/20 bg-info-soft text-info font-medium",
        "week-off": "border-border bg-muted text-muted-foreground font-medium",
        holiday: "border-warning/20 bg-warning-soft text-warning font-medium",
        "half-day": "border-info/20 bg-info-soft text-info font-medium",
        draft: "border-border bg-muted text-muted-foreground font-medium",
        locked: "border-destructive/20 bg-destructive-soft text-destructive font-medium",
        processed: "border-success/20 bg-success-soft text-success font-medium",
        approved: "border-success/20 bg-success-soft text-success font-medium",
        pending: "border-warning/20 bg-warning-soft text-warning font-medium",
        rejected: "border-destructive/20 bg-destructive-soft text-destructive font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
