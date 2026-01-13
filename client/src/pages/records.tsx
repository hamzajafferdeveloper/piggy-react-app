import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading-skeleton";
import { format } from "date-fns";
import { CalendarIcon, FileText, Search, Download } from "lucide-react";
import type { HoursSubmission, Department } from "@shared/schema";

interface SubmissionWithDepartment extends HoursSubmission {
  department: Department;
}

type StatusFilter = "all" | "pending" | "approved" | "rejected";

export default function Records() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const { data: submissions, isLoading } = useQuery<SubmissionWithDepartment[]>({
    queryKey: ["/api/submissions"],
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const filteredSubmissions = submissions?.filter((submission) => {
    if (statusFilter !== "all" && submission.status !== statusFilter) return false;
    if (departmentFilter !== "all" && submission.departmentId !== departmentFilter) return false;
    if (dateFrom && new Date(submission.date) < dateFrom) return false;
    if (dateTo && new Date(submission.date) > dateTo) return false;
    return true;
  });

  const handleExportCSV = () => {
    if (!filteredSubmissions || filteredSubmissions.length === 0) return;

    const headers = ["Date", "Department", "Hours", "Status", "Notes", "Submitted"];
    const rows = filteredSubmissions.map((s) => [
      format(new Date(s.date), "yyyy-MM-dd"),
      s.department?.name || "N/A",
      s.totalHours.toString(),
      s.status,
      s.notes || "",
      format(new Date(s.createdAt!), "yyyy-MM-dd HH:mm"),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
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
          <p className="text-muted-foreground">View and filter your overtime hour submissions</p>
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
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Department</label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
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
              <Popover>
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
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Popover>
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
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
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
              ? `Showing ${filteredSubmissions.length} record${filteredSubmissions.length !== 1 ? "s" : ""}`
              : "Loading..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={10} columns={6} />
          ) : filteredSubmissions && filteredSubmissions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Department</th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Time</th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Hours</th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((submission) => (
                    <tr key={submission.id} className="border-b last:border-0 hover-elevate" data-testid={`row-record-${submission.id}`}>
                      <td className="py-4 px-4 font-mono text-sm">
                        {format(new Date(submission.date), "MMM dd, yyyy")}
                      </td>
                      <td className="py-4 px-4 text-sm">
                        {submission.department?.name || "N/A"}
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {submission.startTime && submission.endTime
                          ? `${submission.startTime} - ${submission.endTime}`
                          : "-"}
                      </td>
                      <td className="py-4 px-4 font-mono text-sm font-medium">
                        {submission.totalHours}h
                      </td>
                      <td className="py-4 px-4">
                        <StatusBadge status={submission.status} />
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground max-w-xs truncate">
                        {submission.notes || "-"}
                      </td>
                    </tr>
                  ))}
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
    </div>
  );
}
