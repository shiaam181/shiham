import { cn } from '@/lib/utils';
import { LucideIcon, Info } from 'lucide-react';

type BannerVariant = 'info' | 'success' | 'warning' | 'error';

const variantStyles: Record<BannerVariant, string> = {
  info: 'bg-blue-500/5 border-blue-500/20 text-blue-700 dark:text-blue-400',
  success: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
  warning: 'bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400',
  error: 'bg-destructive/5 border-destructive/20 text-destructive',
};

interface InfoBannerProps {
  variant?: BannerVariant;
  icon?: LucideIcon;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function InfoBanner({ variant = 'info', icon: Icon = Info, title, children, className }: InfoBannerProps) {
  return (
    <div className={cn('flex gap-3 rounded-lg border p-3.5', variantStyles[variant], className)}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="text-xs leading-relaxed">
        {title && <p className="font-semibold text-sm mb-0.5">{title}</p>}
        {children}
      </div>
    </div>
  );
}
