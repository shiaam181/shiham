import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserCheck, UserX, Clock, Loader2, Mail, Calendar } from "lucide-react";
import { format } from "date-fns";

interface PendingEmployee {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string | null;
  position: string | null;
  created_at: string;
  registration_status: string;
}

interface PendingEmployeesListProps {
  companyId: string;
  onUpdate?: () => void;
}

export function PendingEmployeesList({ companyId, onUpdate }: PendingEmployeesListProps) {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<PendingEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "approve" | "decline";
    employee: PendingEmployee | null;
  }>({ open: false, action: "approve", employee: null });

  const fetchPendingEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, department, position, created_at, registration_status")
        .eq("company_id", companyId)
        .eq("is_active", false)
        .in("registration_status", ["pending"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEmployees((data as PendingEmployee[]) || []);
    } catch (error) {
      console.error("Error fetching pending employees:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingEmployees();
  }, [companyId]);

  const handleApprove = async (employee: PendingEmployee) => {
    setProcessingId(employee.user_id);
    try {
      // Call the approve-employee edge function
      const { data, error } = await supabase.functions.invoke("approve-employee", {
        body: { employeeUserId: employee.user_id },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Failed to approve");
      }

      // Update registration_status to approved
      await supabase
        .from("profiles")
        .update({ registration_status: "approved" })
        .eq("user_id", employee.user_id);

      toast({
        title: "Employee Approved",
        description: `${employee.full_name} can now access the app.`,
      });

      fetchPendingEmployees();
      onUpdate?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve employee",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
      setConfirmDialog({ open: false, action: "approve", employee: null });
    }
  };

  const handleDecline = async (employee: PendingEmployee) => {
    setProcessingId(employee.user_id);
    try {
      // Update status to declined
      const { error } = await supabase
        .from("profiles")
        .update({ registration_status: "declined" })
        .eq("user_id", employee.user_id);

      if (error) throw error;

      toast({
        title: "Registration Declined",
        description: `${employee.full_name}'s registration has been declined.`,
      });

      fetchPendingEmployees();
      onUpdate?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to decline employee",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
      setConfirmDialog({ open: false, action: "decline", employee: null });
    }
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

  if (employees.length === 0) {
    return null; // Don't show if no pending employees
  }

  return (
    <>
      <Card className="border-warning/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-warning/10">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <CardTitle className="text-lg">Pending Approvals</CardTitle>
              <CardDescription>
                {employees.length} employee{employees.length !== 1 ? "s" : ""} waiting for approval
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="hidden sm:table-cell">Requested</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium">{emp.full_name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {emp.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(emp.created_at), "MMM d, yyyy")}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => setConfirmDialog({ open: true, action: "decline", employee: emp })}
                        disabled={processingId === emp.user_id}
                      >
                        {processingId === emp.user_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserX className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline ml-1">Decline</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setConfirmDialog({ open: true, action: "approve", employee: emp })}
                        disabled={processingId === emp.user_id}
                      >
                        {processingId === emp.user_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserCheck className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline ml-1">Approve</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "approve" ? "Approve Employee?" : "Decline Registration?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "approve" ? (
                <>
                  <strong>{confirmDialog.employee?.full_name}</strong> will be able to access the app and 
                  record attendance for your company.
                </>
              ) : (
                <>
                  <strong>{confirmDialog.employee?.full_name}</strong>'s registration will be declined. 
                  They will be notified and can choose to register with a different company.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog.employee) {
                  if (confirmDialog.action === "approve") {
                    handleApprove(confirmDialog.employee);
                  } else {
                    handleDecline(confirmDialog.employee);
                  }
                }
              }}
              className={confirmDialog.action === "decline" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {confirmDialog.action === "approve" ? "Approve" : "Decline"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}