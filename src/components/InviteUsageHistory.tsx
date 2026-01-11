import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, Calendar, Mail, Globe, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface InviteUsageRecord {
  id: string;
  invite_code: string;
  user_email: string;
  user_name: string | null;
  joined_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface InviteUsageHistoryProps {
  companyId: string;
}

export function InviteUsageHistory({ companyId }: InviteUsageHistoryProps) {
  const [records, setRecords] = useState<InviteUsageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsageHistory();
  }, [companyId]);

  const fetchUsageHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('invite_usage_history')
        .select('id, invite_code, user_email, user_name, joined_at, ip_address, user_agent')
        .eq('company_id', companyId)
        .order('joined_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching invite usage history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getBrowserFromUserAgent = (userAgent: string | null): string => {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Other';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Invite Link Usage History
        </CardTitle>
        <CardDescription>
          Track who joined your company and when they used the invite link
        </CardDescription>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No invite link usage recorded yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Usage will appear here when employees join via the invite link.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="hidden md:table-cell">Invite Code</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="hidden lg:table-cell">Browser</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{record.user_name || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {record.user_email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="font-mono text-xs">
                        {record.invite_code.substring(0, 8)}...
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(record.joined_at), 'MMM d, yyyy')}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(record.joined_at), 'h:mm a')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Globe className="w-3 h-3" />
                        {getBrowserFromUserAgent(record.user_agent)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
