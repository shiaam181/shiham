import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

type StatusType = 'configured' | 'not-configured' | 'warning';

const config: Record<StatusType, { icon: typeof CheckCircle2; label: string; classes: string }> = {
  configured: { icon: CheckCircle2, label: 'Configured', classes: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400' },
  'not-configured': { icon: XCircle, label: 'Not configured', classes: 'bg-muted text-muted-foreground border-border' },
  warning: { icon: AlertTriangle, label: 'Attention', classes: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400' },
};

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const c = config[status];
  const Icon = c.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', c.classes, className)}>
      <Icon className="h-3 w-3" />
      {label || c.label}
    </span>
  );
}
