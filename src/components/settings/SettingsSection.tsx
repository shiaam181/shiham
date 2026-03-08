import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  badge?: React.ReactNode;
}

export function SettingsSection({ title, description, icon: Icon, children, className, badge }: SettingsSectionProps) {
  return (
    <div className={cn('rounded-xl border bg-card', className)}>
      <div className="px-6 py-5 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4.5 w-4.5 text-primary" />
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
          </div>
          {badge}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
