import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { format } from "date-fns";
import { CheckSquare, CheckCircle, XCircle, Clock, User } from "lucide-react";
import type { HoursSubmission, Department, User as UserType } from "@shared/schema";

interface SubmissionWithDetails extends HoursSubmission {
  department: Department;
  user: UserType;
}

export default function Approvals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithDetails | null>(null);
  const [comment, setComment] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  const { data: pendingApprovals, isLoading } = useQuery<SubmissionWithDetails[]>({
    queryKey: ["/api/approvals/pending"],
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, status, comment }: { id: string; status: "approved" | "rejected"; comment?: string }) => {
      return apiRequest("POST", `/api/submissions/${id}/approve`, { status, comment });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: actionType === "approve" ? "Submission approved successfully." : "Submission rejected.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/approvals/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setSelectedSubmission(null);
      setComment("");
      setActionType(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to process approval. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAction = (submission: SubmissionWithDetails, action: "approve" | "reject") => {
    setSelectedSubmission(submission);
    setActionType(action);
    setComment("");
  };

  const confirmAction = () => {
    if (!selectedSubmission || !actionType) return;
    
    if (actionType === "reject" && !comment.trim()) {
      toast({
        title: "Comment Required",
        description: "Please provide a reason for rejection.",
        variant: "destructive",
      });
      return;
    }

    approveMutation.mutate({
      id: selectedSubmission.id,
      status: actionType === "approve" ? "approved" : "rejected",
      comment: comment.trim() || undefined,
    });
  };

  const filteredApprovals = pendingApprovals?.filter((approval) => {
    if (departmentFilter !== "all" && approval.departmentId !== departmentFilter) return false;
    return true;
  });

  const getInitials = (user: UserType) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pending Approvals</h1>
          <p className="text-muted-foreground">Review and approve overtime hour submissions</p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2 gap-2">
          <Clock className="h-4 w-4" />
          {filteredApprovals?.length || 0} Pending
        </Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-lg">Filter by Department</CardTitle>
          </div>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-48" data-testid="select-department-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments?.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approval Queue</CardTitle>
          <CardDescription>
            {filteredApprovals
              ? `${filteredApprovals.length} submission${filteredApprovals.length !== 1 ? "s" : ""} awaiting review`
              : "Loading..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} columns={7} />
          ) : filteredApprovals && filteredApprovals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Employee</th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Department</th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Hours</th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Notes</th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Submitted</th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApprovals.map((approval) => (
                    <tr key={approval.id} className="border-b last:border-0 hover-elevate" data-testid={`row-approval-${approval.id}`}>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={approval.user?.profileImageUrl || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(approval.user)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">
                              {approval.user?.firstName && approval.user?.lastName
                                ? `${approval.user.firstName} ${approval.user.lastName}`
                                : approval.user?.email || "Unknown"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm">
                        {approval.department?.name || "N/A"}
                      </td>
                      <td className="py-4 px-4 font-mono text-sm">
                        {format(new Date(approval.date), "MMM dd, yyyy")}
                      </td>
                      <td className="py-4 px-4 font-mono text-sm font-medium">
                        {approval.totalHours}h
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground max-w-xs truncate">
                        {approval.notes || "-"}
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {format(new Date(approval.createdAt!), "MMM dd")}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/30"
                            onClick={() => handleAction(approval, "approve")}
                            data-testid={`button-approve-${approval.id}`}
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/30"
                            onClick={() => handleAction(approval, "reject")}
                            data-testid={`button-reject-${approval.id}`}
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={CheckSquare}
              title="No pending approvals"
              description="All submissions have been reviewed. Check back later for new requests."
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve Submission" : "Reject Submission"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? "Confirm approval of this overtime submission."
                : "Please provide a reason for rejection."}
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Employee</p>
                  <p className="font-medium">
                    {selectedSubmission.user?.firstName && selectedSubmission.user?.lastName
                      ? `${selectedSubmission.user.firstName} ${selectedSubmission.user.lastName}`
                      : selectedSubmission.user?.email || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Department</p>
                  <p className="font-medium">{selectedSubmission.department?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium font-mono">
                    {format(new Date(selectedSubmission.date), "MMM dd, yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Hours</p>
                  <p className="font-medium font-mono">{selectedSubmission.totalHours}h</p>
                </div>
              </div>

              {selectedSubmission.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm bg-muted p-3 rounded-md">{selectedSubmission.notes}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">
                  Comment {actionType === "reject" ? "(Required)" : "(Optional)"}
                </label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={actionType === "reject" ? "Please provide a reason for rejection..." : "Add an optional comment..."}
                  className="mt-2"
                  data-testid="textarea-approval-comment"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedSubmission(null)}
              data-testid="button-cancel-action"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmAction}
              disabled={approveMutation.isPending}
              variant={actionType === "approve" ? "default" : "destructive"}
              data-testid="button-confirm-action"
            >
              {approveMutation.isPending
                ? "Processing..."
                : actionType === "approve"
                  ? "Confirm Approval"
                  : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
