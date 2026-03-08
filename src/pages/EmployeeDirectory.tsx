import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Search, Mail, Phone, MapPin, Building2, Briefcase } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface DirectoryEmployee {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  designation: string | null;
  work_location: string | null;
  avatar_url: string | null;
  employee_code: string | null;
  date_of_joining: string | null;
}

export default function EmployeeDirectory() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<DirectoryEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, email, phone, department, designation, work_location, avatar_url, employee_code, date_of_joining')
      .eq('is_active', true)
      .order('full_name');
    setEmployees(data || []);
    setLoading(false);
  };

  const departments = [...new Set(employees.filter(e => e.department).map(e => e.department!))].sort();
  const locations = [...new Set(employees.filter(e => e.work_location).map(e => e.work_location!))].sort();

  const filtered = employees.filter(e => {
    if (deptFilter !== 'all' && e.department !== deptFilter) return false;
    if (locationFilter !== 'all' && e.work_location !== locationFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        e.full_name.toLowerCase().includes(s) ||
        e.email.toLowerCase().includes(s) ||
        e.department?.toLowerCase().includes(s) ||
        e.designation?.toLowerCase().includes(s) ||
        e.employee_code?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
        <PageHeader
          title="Employee Directory"
          description={`${employees.length} active employees`}
          icon={<Users className="w-5 h-5 text-primary" />}
        />

        {/* Filters */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, code..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <Building2 className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <MapPin className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Employee Grid */}
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No employees found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(emp => (
              <Card key={emp.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-11 h-11 shrink-0">
                      <AvatarImage src={emp.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {getInitials(emp.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">{emp.full_name}</h3>
                        {emp.employee_code && (
                          <Badge variant="outline" className="text-[10px] shrink-0">{emp.employee_code}</Badge>
                        )}
                      </div>
                      {emp.designation && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Briefcase className="w-3 h-3" />{emp.designation}
                        </p>
                      )}
                      <div className="mt-2 space-y-1">
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                          <Mail className="w-3 h-3 shrink-0" />{emp.email}
                        </p>
                        {emp.phone && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <Phone className="w-3 h-3 shrink-0" />{emp.phone}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {emp.department && (
                            <Badge variant="secondary" className="text-[10px]">{emp.department}</Badge>
                          )}
                          {emp.work_location && (
                            <Badge variant="outline" className="text-[10px]">
                              <MapPin className="w-2.5 h-2.5 mr-0.5" />{emp.work_location}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
