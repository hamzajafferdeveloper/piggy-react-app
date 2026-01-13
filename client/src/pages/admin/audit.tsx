import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading-skeleton";
import { format } from "date-fns";
import { History, CalendarIcon, User, FileText, Settings, Building2, Shield } from "lucide-react";
import type { AuditLog, User as UserType } from "@shared/schema";

interface AuditLogWithUser extends AuditLog {
  user: UserType;
}

const actionIcons: Record<string, any> = {
  "submission_created": FileText,
  "submission_approved": Shield,
  "submission_rejected": Shield,
  "department_created": Building2,
  "department_updated": Building2,
  "department_deleted": Building2,
  "user_role_updated": Settings,
  "default": History,
};

const actionColors: Record<string, string> = {
  "submission_created": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  "submission_approved": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  "submission_rejected": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  "department_created": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  "department_updated": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  "department_deleted": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  "user_role_updated": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  "default": "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export default function AuditLog() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const { data: auditLogs, isLoading } = useQuery<AuditLogWithUser[]>({
    queryKey: ["/api/admin/audit"],
  });

  const filteredLogs = auditLogs?.filter((log) => {
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    if (dateFrom && new Date(log.createdAt!) < dateFrom) return false;
    if (dateTo && new Date(log.createdAt!) > dateTo) return false;
    return true;
  });

  const getInitials = (user: UserType) => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const formatAction = (action: string) => {
    return action.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  const clearFilters = () => {
    setActionFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const uniqueActions = [...new Set(auditLogs?.map(log => log.action) || [])];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground">Track all system actions and changes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Action Type</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger data-testid="select-action-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {formatAction(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="button-date-from">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal" data-testid="button-date-to">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-end">
              <Button variant="ghost" onClick={clearFilters} data-testid="button-clear-filters">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>
            {filteredLogs
              ? `${filteredLogs.length} event${filteredLogs.length !== 1 ? "s" : ""} recorded`
              : "Loading..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={10} columns={4} />
          ) : filteredLogs && filteredLogs.length > 0 ? (
            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-6">
                {filteredLogs.map((log, index) => {
                  const Icon = actionIcons[log.action] || actionIcons.default;
                  const colorClass = actionColors[log.action] || actionColors.default;
                  
                  return (
                    <div key={log.id} className="relative flex gap-6" data-testid={`audit-log-${log.id}`}>
                      <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {formatAction(log.action)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.createdAt!), "MMM dd, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={log.user?.profileImageUrl || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(log.user)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {log.user?.firstName && log.user?.lastName
                              ? `${log.user.firstName} ${log.user.lastName}`
                              : log.user?.email || "Unknown"}
                          </span>
                        </div>
                        {(log.oldValue || log.newValue) && (
                          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                            {log.oldValue && <p>From: {log.oldValue}</p>}
                            {log.newValue && <p>To: {log.newValue}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState
              icon={History}
              title="No audit logs found"
              description={actionFilter !== "all" || dateFrom || dateTo
                ? "No logs match your current filters."
                : "System activity will appear here."}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
