import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  backTo?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon, backTo, actions, className }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 sm:mb-6", className)}>
      <div className="flex items-center gap-3 min-w-0">
        {backTo && (
          <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => navigate(backTo)}>
            <ArrowLeft className="w-4.5 h-4.5" />
          </Button>
        )}
        {icon && (
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-display font-bold tracking-tight truncate">{title}</h1>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
