import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TestConnectionProps {
  label?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onTest: () => void;
  isTesting: boolean;
  testResult: 'success' | 'error' | null;
  disabled?: boolean;
  inputType?: string;
  className?: string;
  buttonLabel?: string;
}

export function TestConnection({ label, placeholder, value, onChange, onTest, isTesting, testResult, disabled, inputType = 'email', className, buttonLabel = 'Test' }: TestConnectionProps) {
  return (
    <div className={cn('rounded-lg border border-dashed border-border/70 bg-muted/20 p-4', className)}>
      {label && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">{label}</p>}
      <div className="flex gap-2">
        <Input
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-background text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={onTest}
          disabled={isTesting || disabled}
          className="shrink-0 gap-1.5 min-w-[90px]"
        >
          {isTesting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : testResult === 'success' ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          ) : testResult === 'error' ? (
            <XCircle className="h-3.5 w-3.5 text-destructive" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}
