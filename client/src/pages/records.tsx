import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CalendarIcon,
  FileText,
  Search,
  Download,
  Edit,
  X,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils"; // Import cn
import type {
  HoursSubmission,
  Department,
  HoursWithdrawal,
} from "@shared/schema";

interface SubmissionWithDepartment extends HoursSubmission {
  department: Department;
  type: "submission";
}

interface WithdrawalWithDetails extends HoursWithdrawal {
  type: "withdrawal";
  // Mock department for table consistency if needed, or handle undefined
  department: undefined;
}

type RecordItem = SubmissionWithDepartment | WithdrawalWithDetails;

type AttachmentMeta = {
  originalName: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
};
import { FilePreviewModal } from "@/components/file-preview-modal"; // Added import
import { format } from "date-fns";

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type ActionType = "edit" | "cancel" | null;

export default function Records() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [isFromDateOpen, setIsFromDateOpen] = useState(false);
  const [isToDateOpen, setIsToDateOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] =
    useState<SubmissionWithDepartment | null>(null);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [editData, setEditData] = useState({
    totalHours: 0,
    notes: "",
    date: "",
    startTime: "",
    endTime: "",
  });
  const [existingAttachments, setExistingAttachments] = useState<
    AttachmentMeta[]
  >([]);
  const [removedAttachments, setRemovedAttachments] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [previewFiles, setPreviewFiles] = useState<AttachmentMeta[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const { data: submissions, isLoading: submissionsLoading } = useQuery<
    SubmissionWithDepartment[]
  >({
    queryKey: ["/api/submissions"],
  });

  const { data: withdrawals, isLoading: withdrawalsLoading } = useQuery<
    HoursWithdrawal[]
  >({
    queryKey: ["/api/withdrawals"],
  });

  const allRecords: RecordItem[] = [
    ...(submissions?.map((s) => ({ ...s, type: "submission" as const })) || []),
    ...(withdrawals?.map((w) => ({
      ...w,
      type: "withdrawal" as const,
      department: undefined,
    })) || []),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const isLoading = submissionsLoading || withdrawalsLoading;

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  // Edit Mutation
  const editMutation = useMutation({
    mutationFn: async ({
      id,
      data,
      files,
      removed,
    }: {
      id: string;
      data: {
        totalHours: number;
        notes: string;
        date: string;
        startTime: string;
        endTime: string;
      };
      files: File[];
      removed: string[];
    }) => {
      const formData = new FormData();
      formData.append("totalHours", data.totalHours.toString());
      formData.append("notes", data.notes);
      formData.append("date", data.date);
      if (data.startTime) formData.append("startTime", data.startTime);
      if (data.endTime) formData.append("endTime", data.endTime);
      if (removed.length > 0) {
        formData.append("removedAttachments", JSON.stringify(removed));
      }
      if (files.length > 0) {
        files.forEach((file) => {
          formData.append("files", file);
        });
      }

      const response = await fetch(`/api/submissions/${id}`, {
        method: "PATCH",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to update submission.");
      }

      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Submission updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      setSelectedSubmission(null);
      setActionType(null);
      setExistingAttachments([]);
      setRemovedAttachments([]);
      setNewFiles([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update submission.",
        variant: "destructive",
      });
    },
  });

  // Cancel Mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("POST", `/api/submissions/${id}/cancel`, { reason });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Submission cancelled successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      setSelectedSubmission(null);
      setActionType(null);
      setCancelReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel submission.",
        variant: "destructive",
      });
    },
  });

  const handleAction = (
    submission: SubmissionWithDepartment,
    action: "edit" | "cancel",
  ) => {
    setSelectedSubmission(submission);
    setActionType(action);
    if (action === "edit") {
      const parsedAttachments = submission.attachments
        ? (JSON.parse(submission.attachments) as AttachmentMeta[])
        : [];
      setEditData({
        totalHours: submission.totalHours,
        notes: submission.notes || "",
        date: format(new Date(submission.date), "yyyy-MM-dd"),
        startTime: submission.startTime || "",
        endTime: submission.endTime || "",
      });
      setExistingAttachments(parsedAttachments);
      setRemovedAttachments([]);
      setNewFiles([]);
    }
    setCancelReason("");
  };

  const confirmAction = () => {
    if (!selectedSubmission) return;

    if (actionType === "edit") {
      editMutation.mutate({
        id: selectedSubmission.id,
        data: {
          totalHours: editData.totalHours,
          notes: editData.notes,
          date: editData.date,
          startTime: editData.startTime,
          endTime: editData.endTime,
        },
        files: newFiles,
        removed: removedAttachments,
      });
    } else if (actionType === "cancel") {
      if (cancelReason.trim().length < 5) {
        toast({
          title: "Reason Required",
          description: "Cancellation reason must be at least 5 characters.",
          variant: "destructive",
        });
        return;
      }
      cancelMutation.mutate({
        id: selectedSubmission.id,
        reason: cancelReason.trim(),
      });
    }
  };

  const filteredSubmissions = allRecords?.filter((record) => {
    // Determine status for record
    const recordStatus =
      record.type === "submission" ? record.status : record.status;

    if (statusFilter !== "all" && recordStatus !== statusFilter) return false;

    if (departmentFilter !== "all") {
      if (record.type === "withdrawal") return false; // Withdrawals don't have depts usually
      if (record.departmentId !== departmentFilter) return false;
    }

    if (dateFrom && new Date(record.date) < dateFrom) return false;
    if (dateTo && new Date(record.date) > dateTo) return false;
    return true;
  });

  const handleExportCSV = () => {
    if (!filteredSubmissions || filteredSubmissions.length === 0) return;

    const headers = [
      "Date",
      "Department",
      "Hours",
      "Status",
      "Notes",
      "Submitted",
    ];
    const rows = filteredSubmissions.map((s) => [
      format(new Date(s.date), "yyyy-MM-dd"),
      (s.type === "submission" ? s.department?.name : "Withdrawal") || "-",
      s.type === "submission"
        ? s.totalHours.toString()
        : (s as any).amount.toString(), // Handle withdrawal amount
      s.status,
      (s.type === "submission" ? s.notes : (s as any).reason) || "",
      format(new Date(s.createdAt!), "yyyy-MM-dd HH:mm"),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `overtime-records-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setDepartmentFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Records</h1>
          <p className="text-muted-foreground">
            View and manage your overtime hour submissions
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleExportCSV}
          disabled={!filteredSubmissions || filteredSubmissions.length === 0}
          data-testid="button-export-csv"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Department</label>
              <Select
                value={departmentFilter}
                onValueChange={setDepartmentFilter}
              >
                <SelectTrigger data-testid="select-department-filter">
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
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <Popover open={isFromDateOpen} onOpenChange={setIsFromDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-date-from"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => {
                      setDateFrom(date);
                      setIsFromDateOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Popover open={isToDateOpen} onOpenChange={setIsToDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-date-to"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => {
                      setDateTo(date);
                      setIsToDateOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submission History</CardTitle>
          <CardDescription>
            {filteredSubmissions
              ? `Showing ${filteredSubmissions.length} record${
                  filteredSubmissions.length !== 1 ? "s" : ""
                }`
              : "Loading..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={10} columns={7} />
          ) : filteredSubmissions && filteredSubmissions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      File
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Date
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Department
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Time
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Hours
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((record) => {
                    const isSubmission = record.type === "submission";
                    const attachments =
                      isSubmission && record.attachments
                        ? (JSON.parse(record.attachments) as AttachmentMeta[])
                        : [];
                    const attachment = attachments[0];
                    const isImage = attachment?.mimeType?.startsWith("image/");

                    // For withdrawals, handle amount display
                    const hoursDisplay = isSubmission
                      ? `${record.totalHours}h`
                      : `-${(record as any).amount}h`;

                    const notes = isSubmission
                      ? record.notes
                      : (record as any).reason;

                    return (
                      <tr
                        key={`${record.type}-${record.id}`}
                        className="border-b last:border-0 hover-elevate"
                        data-testid={`row-record-${record.id}`}
                      >
                        <td className="py-4 px-4 text-sm">
                          {isSubmission && attachments.length > 0 ? (
                            attachments.length > 1 ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setPreviewFiles(attachments);
                                  setIsPreviewOpen(true);
                                }}
                              >
                                {attachments.length} Files
                              </Button>
                            ) : isImage ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewFiles([attachment]);
                                  setIsPreviewOpen(true);
                                }}
                                className="rounded"
                              >
                                <img
                                  src={attachment.url}
                                  alt={attachment.originalName}
                                  className="h-10 w-10 rounded object-cover"
                                />
                              </button>
                            ) : (
                              <a
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline"
                              >
                                {attachment.originalName}
                              </a>
                            )
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-4 px-4 font-mono text-sm">
                          {format(new Date(record.date), "MMM dd, yyyy")}
                        </td>
                        <td className="py-4 px-4 text-sm">
                          {isSubmission ? (
                            record.department?.name || "N/A"
                          ) : (
                            <span className="text-orange-600 font-medium">
                              Withdrawal
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-sm text-muted-foreground">
                          {isSubmission && record.startTime && record.endTime
                            ? `${record.startTime} - ${record.endTime}`
                            : (record as any).startTime &&
                                (record as any).endTime
                              ? `${(record as any).startTime} - ${
                                  (record as any).endTime
                                }`
                              : "-"}
                        </td>
                        <td
                          className={cn(
                            "py-4 px-4 font-mono text-sm font-medium",
                            !isSubmission && "text-red-500",
                          )}
                        >
                          {hoursDisplay}
                        </td>
                        <td className="py-4 px-4">
                          <StatusBadge
                            status={isSubmission ? record.status : "withdrawn"}
                          />
                        </td>
                        <td className="py-4 px-4 text-sm text-muted-foreground max-w-xs truncate">
                          {notes || "-"}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex justify-end gap-2">
                            {isSubmission &&
                              record.status === "pending" &&
                              !record.isCancelled && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5"
                                    onClick={() => handleAction(record, "edit")}
                                    data-testid={`button-edit-${record.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() =>
                                      handleAction(record, "cancel")
                                    }
                                    data-testid={`button-cancel-${record.id}`}
                                  >
                                    <X className="h-4 w-4" />
                                    Cancel
                                  </Button>
                                </>
                              )}
                            {isSubmission && record.isCancelled && (
                              <span className="text-sm text-muted-foreground">
                                Cancelled
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No records found"
              description="No submissions match your current filters. Try adjusting your search criteria."
              action={{
                label: "Clear Filters",
                onClick: clearFilters,
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={actionType === "edit"}
        onOpenChange={() => setActionType(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Submission</DialogTitle>
            <DialogDescription>
              Update the details of your overtime submission.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Total Hours</label>
              <Input
                type="number"
                step="0.5"
                value={editData.totalHours}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    totalHours: parseFloat(e.target.value),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={editData.date}
                onChange={(e) =>
                  setEditData({ ...editData, date: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Time</label>
                <Input
                  type="time"
                  value={editData.startTime}
                  onChange={(e) =>
                    setEditData({ ...editData, startTime: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Time</label>
                <Input
                  type="time"
                  value={editData.endTime}
                  onChange={(e) =>
                    setEditData({ ...editData, endTime: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={editData.notes}
                onChange={(e) =>
                  setEditData({ ...editData, notes: e.target.value })
                }
                placeholder="Add any additional notes..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Current Attachments</label>
              {existingAttachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attachments.</p>
              ) : (
                <ul className="space-y-2">
                  {existingAttachments.map((attachment) => {
                    const isRemoved = removedAttachments.includes(
                      attachment.filename,
                    );
                    return (
                      <li
                        key={attachment.filename}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          className={
                            isRemoved
                              ? "line-through text-muted-foreground"
                              : "text-primary hover:underline"
                          }
                        >
                          {attachment.originalName}
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRemovedAttachments((prev) =>
                              prev.includes(attachment.filename)
                                ? prev.filter(
                                    (name) => name !== attachment.filename,
                                  )
                                : [...prev, attachment.filename],
                            );
                          }}
                        >
                          {isRemoved ? "Undo" : "Remove"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Add Attachments</label>
              <label className="text-sm font-medium">Add Attachments</label>
              <Input
                type="file"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setNewFiles(files);
                }}
              />
            </div>
            {newFiles.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {newFiles.length} file{newFiles.length !== 1 ? "s" : ""}{" "}
                selected
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            <Button onClick={confirmAction} disabled={editMutation.isPending}>
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FilePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        files={previewFiles}
      />

      {/* Cancel Dialog */}
      <Dialog
        open={actionType === "cancel"}
        onOpenChange={() => setActionType(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Submission</DialogTitle>
            <DialogDescription>
              This will mark the submission as cancelled. Please provide a
              reason.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Cancellation Reason (Required)
              </label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please provide a reason for cancellation (minimum 5 characters)..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {cancelReason.length}/5 characters (minimum required)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmAction}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending
                ? "Cancelling..."
                : "Confirm Cancellation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
