import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import LeaveRequestForm from '@/components/LeaveRequestForm';

export default function MyLeaves() {
  const { user } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);

  const fetchLeaves = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setLeaveRequests(data || []);
  };

  useEffect(() => { fetchLeaves(); }, [user]);

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <LeaveRequestForm leaveRequests={leaveRequests} onRefresh={fetchLeaves} />
      </main>
    </AppLayout>
  );
}
