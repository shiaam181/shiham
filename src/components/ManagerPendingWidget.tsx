import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Calendar, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ManagerPendingWidget() {
  const { isManager } = useAuth();
  const navigate = useNavigate();
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [pendingRegs, setPendingRegs] = useState(0);

  useEffect(() => {
    if (!isManager) return;
    const fetch = async () => {
      const [lr, rr] = await Promise.all([
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('regularization_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      setPendingLeaves(lr.count || 0);
      setPendingRegs(rr.count || 0);
    };
    fetch();
  }, [isManager]);

  if (!isManager) return null;
  const total = pendingLeaves + pendingRegs;
  if (total === 0) return null;

  return (
    <Card className="border-primary/30 bg-accent/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <UserCheck className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Pending Approvals</p>
              <div className="flex items-center gap-2 mt-1">
                {pendingLeaves > 0 && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Calendar className="w-2.5 h-2.5" /> {pendingLeaves} Leave{pendingLeaves !== 1 ? 's' : ''}
                  </Badge>
                )}
                {pendingRegs > 0 && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Clock className="w-2.5 h-2.5" /> {pendingRegs} Correction{pendingRegs !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button size="sm" variant="default" className="h-8 text-xs" onClick={() => navigate('/manager/approvals')}>
            Review
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
