import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { UserCheck, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ProfileCompletionCard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  if (!profile) return null;

  const fields = [
    { label: 'Full Name', filled: !!profile.full_name },
    { label: 'Phone', filled: !!profile.phone },
    { label: 'Department', filled: !!profile.department },
    { label: 'Designation', filled: !!profile.designation },
    { label: 'Work Location', filled: !!profile.work_location },
    { label: 'Employee Code', filled: !!profile.employee_code },
    { label: 'Bank Name', filled: !!profile.bank_name },
    { label: 'Bank Account', filled: !!profile.bank_account_number },
    { label: 'Bank IFSC', filled: !!profile.bank_ifsc },
    { label: 'Date of Joining', filled: !!profile.date_of_joining },
  ];

  const filled = fields.filter(f => f.filled).length;
  const total = fields.length;
  const pct = Math.round((filled / total) * 100);

  if (pct === 100) return null;

  const missing = fields.filter(f => !f.filled).slice(0, 3);

  return (
    <Card className="border-warning/30 bg-warning-soft/30">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-warning/20 flex items-center justify-center shrink-0">
            <UserCheck className="w-4.5 h-4.5 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold">Complete Your Profile</p>
              <span className="text-xs font-bold text-warning">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5 mb-2" />
            <div className="flex flex-wrap gap-1 mb-2">
              {missing.map(f => (
                <span key={f.label} className="text-[10px] px-1.5 py-0.5 bg-warning/10 text-warning rounded">
                  {f.label}
                </span>
              ))}
              {fields.filter(f => !f.filled).length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{fields.filter(f => !f.filled).length - 3} more</span>
              )}
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate('/profile')}>
              Complete Now
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
