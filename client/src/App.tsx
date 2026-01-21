import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import SubmitHours from "@/pages/submit-hours";
import WithdrawHours from "@/pages/withdraw-hours"; // NEW
import Records from "@/pages/records";
import Approvals from "@/pages/approvals";
import AdminDashboard from "@/pages/admin";
import ManageUsers from "@/pages/admin/users";
import ManageDepartments from "@/pages/admin/departments";
import AuditLog from "@/pages/admin/audit";
import { useEffect } from "react";
import AllApprovals from "./pages/all-approvals";

// Helper to determine primary role
function getPrimaryRole(roles: string[]): string {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("hr")) return "hr";
  if (roles.includes("approver")) return "approver";
  return "employee";
}

// Helper to get default dashboard path for role
function getDefaultDashboard(roles: string[]): string {
  const primaryRole = getPrimaryRole(roles);
  switch (primaryRole) {
    case "admin":
      return "/admin";
    case "hr":
    case "approver":
      return "/approvals";
    default:
      return "/dashboard";
  }
}

// Component that redirects to the appropriate dashboard based on user role
function DashboardRedirect() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && "roles" in user && Array.isArray(user.roles)) {
      const defaultPath = getDefaultDashboard(user.roles);
      setLocation(defaultPath);
    } else if (user) {
      // Fallback if roles not yet loaded
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  return <LoadingScreen />;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-4 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthenticatedRouter() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={DashboardRedirect} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/submit" component={SubmitHours} />
        <Route path="/withdraw" component={WithdrawHours} /> {/* NEW */}
        <Route path="/records" component={Records} />
        <Route path="/approvals" component={Approvals} />
        <Route path="/approvals/all" component={AllApprovals} />
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/users" component={ManageUsers} />
        <Route path="/admin/departments" component={ManageDepartments} />
        <Route path="/admin/audit" component={AuditLog} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Skeleton className="h-12 w-12 rounded-full mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
        <Skeleton className="h-3 w-24 mx-auto" />
      </div>
    </div>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/">{!user ? <LandingPage /> : <DashboardRedirect />}</Route>
      <Route>{!user ? <Redirect to="/auth" /> : <AuthenticatedRouter />}</Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
