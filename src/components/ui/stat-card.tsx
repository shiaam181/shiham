import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg?: string;
  valueColor?: string;
  className?: string;
}

export function StatCard({ label, value, icon, iconBg = "bg-primary/10", valueColor, className }: StatCardProps) {
  return (
    <Card className={cn("p-3.5 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] sm:text-xs font-medium text-muted-foreground truncate">{label}</p>
          <p className={cn("text-xl sm:text-2xl font-display font-bold mt-0.5 tabular-nums", valueColor)}>
            {value}
          </p>
        </div>
        <div className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
