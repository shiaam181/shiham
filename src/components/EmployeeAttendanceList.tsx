import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, User, ChevronRight, Users, Building2 } from 'lucide-react';

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  position: string | null;
  company_id: string | null;
  company_name?: string;
}

interface Company {
  id: string;
  name: string;
}

export default function EmployeeAttendanceList() {
  const { profile, role } = useAuth();
  const navigate = useNavigate();
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Map<string, string>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch employees
      let employeesQuery = supabase
        .from('profiles')
        .select('id, user_id, full_name, email, department, position, company_id')
        .eq('is_active', true)
        .order('full_name');

      // If owner, filter to their company only
      if (role === 'owner' && profile?.company_id) {
        employeesQuery = employeesQuery.eq('company_id', profile.company_id);
      }

      const { data: employeesData, error: employeesError } = await employeesQuery;
      if (employeesError) throw employeesError;

      // Fetch companies for grouping
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name');

      const companyMap = new Map<string, string>();
      companiesData?.forEach(c => companyMap.set(c.id, c.name));
      setCompanies(companyMap);

      // Add company names to employees
      const employeesWithCompany = (employeesData || []).map(emp => ({
        ...emp,
        company_name: emp.company_id ? companyMap.get(emp.company_id) || 'Unknown' : 'No Company',
      }));

      setEmployees(employeesWithCompany);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setIsLoading(false);
    }
  }, [role, profile?.company_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredEmployees = employees.filter(emp =>
    emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by company
  const groupedEmployees = filteredEmployees.reduce((acc, emp) => {
    const companyName = emp.company_name || 'No Company';
    if (!acc[companyName]) {
      acc[companyName] = [];
    }
    acc[companyName].push(emp);
    return acc;
  }, {} as Record<string, Employee[]>);

  const handleEmployeeClick = (employee: Employee) => {
    navigate(`/admin/attendance/${employee.user_id}`);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-primary" />
            Employee Attendance
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Click on an employee to view and edit their monthly attendance
          </p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, department, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-3 sm:px-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No employees found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEmployees).map(([companyName, companyEmployees]) => (
              <div key={companyName}>
                {/* Company Header - only show if multiple companies */}
                {Object.keys(groupedEmployees).length > 1 && (
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{companyName}</span>
                    <Badge variant="outline" className="ml-auto">
                      {companyEmployees.length} employees
                    </Badge>
                  </div>
                )}

                {/* Employee List */}
                <div className="space-y-2">
                  {companyEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      onClick={() => handleEmployeeClick(employee)}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{employee.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {employee.department || 'No department'} • {employee.position || 'No position'}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
