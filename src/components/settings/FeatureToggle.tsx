import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface FeatureToggleProps {
  label: string;
  description?: string;
  icon?: LucideIcon;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'warning' | 'danger';
}

const variantStyles = {
  default: 'border-border hover:bg-muted/40',
  warning: 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10',
  danger: 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10',
};

export function FeatureToggle({ label, description, icon: Icon, checked, onCheckedChange, disabled, className, variant = 'default' }: FeatureToggleProps) {
  return (
    <div className={cn('flex items-center justify-between rounded-lg border px-4 py-3.5 transition-colors', variantStyles[variant], className)}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="shrink-0 ml-4" />
    </div>
  );
}
