import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_value: any;
  new_value: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export default function AuditTrail() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!error && data) setLogs(data);
    setLoading(false);
  };

  const uniqueActions = [...new Set(logs.map(l => l.action))];
  const uniqueTables = [...new Set(logs.filter(l => l.table_name).map(l => l.table_name!))];

  const filtered = logs.filter(l => {
    if (actionFilter !== 'all' && l.action !== actionFilter) return false;
    if (tableFilter !== 'all' && l.table_name !== tableFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        l.action.toLowerCase().includes(s) ||
        l.table_name?.toLowerCase().includes(s) ||
        l.user_id.toLowerCase().includes(s) ||
        l.record_id?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const actionColor = (action: string) => {
    if (action === 'INSERT') return 'default';
    if (action === 'UPDATE') return 'secondary';
    if (action === 'DELETE') return 'destructive';
    return 'outline';
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
        <PageHeader
          title="Audit Trail"
          description="Track all system changes and user actions"
          icon={<Shield className="w-5 h-5 text-primary" />}
          backTo="/admin"
        />

        {/* Filters */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by user, table, action..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {uniqueActions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Table" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {uniqueTables.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{logs.length}</p>
            <p className="text-xs text-muted-foreground">Total Events</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-success">{logs.filter(l => l.action === 'INSERT').length}</p>
            <p className="text-xs text-muted-foreground">Inserts</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{logs.filter(l => l.action === 'UPDATE').length}</p>
            <p className="text-xs text-muted-foreground">Updates</p>
          </CardContent></Card>
          <Card><CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{logs.filter(l => l.action === 'DELETE').length}</p>
            <p className="text-xs text-muted-foreground">Deletes</p>
          </CardContent></Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Time</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead className="hidden sm:table-cell">Record ID</TableHead>
                      <TableHead className="hidden md:table-cell">User ID</TableHead>
                      <TableHead className="hidden lg:table-cell">IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No audit logs found
                        </TableCell>
                      </TableRow>
                    ) : filtered.slice(0, 100).map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(log.created_at), 'dd MMM, HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={actionColor(log.action)} className="text-[10px]">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{log.table_name || '-'}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs font-mono truncate max-w-[120px]">
                          {log.record_id?.slice(0, 8) || '-'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs font-mono truncate max-w-[120px]">
                          {log.user_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">{log.ip_address || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        {filtered.length > 100 && (
          <p className="text-xs text-muted-foreground text-center">Showing first 100 of {filtered.length} results</p>
        )}
      </div>
    </AppLayout>
  );
}
