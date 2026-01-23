import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
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
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { StatCardSkeleton, TableSkeleton } from "@/components/loading-skeleton";
import {
  Clock,
  CheckCircle,
  FileText,
  Plus,
  ArrowRight,
  MinusCircle,
} from "lucide-react";
import { format } from "date-fns";
import type { HoursSubmission, Department } from "@shared/schema";

interface DashboardStats {
  totalHoursSubmitted: number;
  pendingCount: number;
  approvedThisMonth: number;
}

interface SubmissionWithDepartment extends HoursSubmission {
  department: Department;
}

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: balanceData, isLoading: balanceLoading } = useQuery<{
    currentBalance: number;
  }>({
    queryKey: ["/api/user/balance"],
  });

  const { data: recentSubmissions, isLoading: submissionsLoading } = useQuery<
    SubmissionWithDepartment[]
  >({
    queryKey: ["/api/submissions", "recent"],
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {user?.firstName || "User"}
          </h1>
          <p className="text-muted-foreground">
            Here's an overview of your overtime hours activity.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-2">
            <Link href="/withdraw">
              <MinusCircle className="h-4 w-4" />
              Withdraw Hours
            </Link>
          </Button>
          <Button asChild className="gap-2" data-testid="button-quick-submit">
            <Link href="/submit">
              <Plus className="h-4 w-4" />
              Submit Hours
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {statsLoading || balanceLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Hours Submitted"
              value={stats?.totalHoursSubmitted || 0}
              icon={Clock}
              description="All time submissions"
            />
            <StatCard
              title="Pending Approvals"
              value={stats?.pendingCount || 0}
              icon={FileText}
              description="Awaiting review"
            />
            {/* <StatCard
              title="Approved This Month"
              value={stats?.approvedThisMonth || 0}
              icon={CheckCircle}
              description="Current month"
            /> */}
          </>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Recent Submissions</CardTitle>
            <CardDescription>
              Your latest overtime hour submissions
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-2"
            data-testid="button-view-all-records"
          >
            <Link href="/records">
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {submissionsLoading ? (
            <TableSkeleton rows={5} columns={5} />
          ) : recentSubmissions && recentSubmissions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Date
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Department
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Hours
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Submitted
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentSubmissions.slice(0, 5).map((submission) => (
                    <tr
                      key={submission.id}
                      className="border-b last:border-0 hover-elevate"
                      data-testid={`row-submission-${submission.id}`}
                    >
                      <td className="py-4 px-4 font-mono text-sm">
                        {format(new Date(submission.date), "MMM dd, yyyy")}
                      </td>
                      <td className="py-4 px-4 text-sm">
                        {submission.department?.name || "N/A"}
                      </td>
                      <td className="py-4 px-4 font-mono text-sm font-medium">
                        {submission.totalHours}h
                      </td>
                      <td className="py-4 px-4">
                        <StatusBadge status={submission.status} />
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {format(new Date(submission.createdAt!), "MMM dd")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No submissions yet"
              description="Start tracking your overtime hours by submitting your first entry."
              action={{
                label: "Submit Hours",
                onClick: () => (window.location.href = "/submit"),
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
