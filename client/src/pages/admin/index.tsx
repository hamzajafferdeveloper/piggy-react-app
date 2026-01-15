import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { StatCardSkeleton, TableSkeleton } from "@/components/loading-skeleton";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import {
  Users,
  Building2,
  Clock,
  FileText,
  ArrowRight,
  BarChart3,
} from "lucide-react";
import type { HoursSubmission, Department, User } from "@shared/schema";

interface AdminStats {
  totalEmployees: number;
  totalDepartments: number;
  pendingApprovals: number;
  hoursThisMonth: number;
}

interface SubmissionWithDetails extends HoursSubmission {
  department: Department;
  user: User;
}

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: recentActivity, isLoading: activityLoading } = useQuery<
    SubmissionWithDetails[]
  >({
    queryKey: ["/api/admin/recent-activity"],
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          System overview and quick actions for administrators.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Employees"
              value={stats?.totalEmployees || 0}
              icon={Users}
              description="Registered users"
            />
            <StatCard
              title="Departments"
              value={stats?.totalDepartments || 0}
              icon={Building2}
              description="Active departments"
            />
            <StatCard
              title="Pending Approvals"
              value={stats?.pendingApprovals || 0}
              icon={FileText}
              description="Awaiting review"
            />
            <StatCard
              title="Hours This Month"
              value={stats?.hoursThisMonth || 0}
              icon={Clock}
              description="Total approved hours"
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 flex flex-col  gap-1">
            <Link href="/admin/users">
              <Button
                variant="outline"
                className="w-full justify-between hover-elevate"
                data-testid="button-manage-users"
              >
                <span className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  Manage Users & Roles
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/admin/departments">
              <Button
                variant="outline"
                className="w-full justify-between hover-elevate"
                data-testid="button-manage-departments"
              >
                <span className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  Manage Departments
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/approvals">
              <Button
                variant="outline"
                className="w-full justify-between hover-elevate"
                data-testid="button-view-approvals"
              >
                <span className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  Review Pending Approvals
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/admin/audit">
              <Button
                variant="outline"
                className="w-full justify-between hover-elevate"
                data-testid="button-view-audit"
              >
                <span className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  View Audit Log
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest system-wide submissions</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <TableSkeleton rows={5} columns={4} />
            ) : recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.slice(0, 5).map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-card border hover-elevate"
                    data-testid={`activity-${activity.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {activity.user?.firstName && activity.user?.lastName
                          ? `${activity.user.firstName} ${activity.user.lastName}`
                          : activity.user?.email || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.department?.name} • {activity.totalHours}h •{" "}
                        {format(new Date(activity.createdAt!), "MMM dd")}
                      </p>
                    </div>
                    <StatusBadge status={activity.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent activity
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
