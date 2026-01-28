import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "./role-badge";
import {
  Clock,
  LayoutDashboard,
  FileText,
  CheckSquare,
  Users,
  Building2,
  BarChart3,
  History,
  LogOut,
} from "lucide-react";

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  // Extract roles from user object (now included in auth response)
  const roles =
    user && "roles" in user && Array.isArray(user.roles)
      ? user.roles
      : ["employee"];

  const isAdmin = roles.includes("admin");
  const isHR = roles.includes("hr") || isAdmin;
  const isApprover = roles.includes("approver") || isHR;
  const primaryRole = isAdmin
    ? "admin"
    : isHR
      ? "hr"
      : isApprover
        ? "approver"
        : "employee";

  const employeeMenuItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Submit Hours", url: "/submit", icon: Clock },
    { title: "My Records", url: "/records", icon: FileText },
  ];

  const approverMenuItems = [
    { title: "Pending Approvals", url: "/approvals", icon: CheckSquare },
    { title: "All Approvals", url: "/approvals/all", icon: CheckSquare },
  ];

  const adminMenuItems = [
    { title: "Admin Dashboard", url: "/admin", icon: BarChart3 },
    { title: "Manage Users", url: "/admin/users", icon: Users },
    { title: "Manage Departments", url: "/admin/departments", icon: Building2 },
    { title: "Audit Log", url: "/admin/audit", icon: History },
  ];

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center">
            <Clock className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">OvertimeTracker</h1>
            <p className="text-xs text-muted-foreground">Hours Management</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Employee</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {employeeMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url}>
                    <Link
                      href={item.url}
                      data-testid={`nav-${item.title
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isApprover && (
          <SidebarGroup>
            <SidebarGroupLabel>Approver</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {approverMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url}>
                      <Link
                        href={item.url}
                        data-testid={`nav-${item.title
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        location === item.url ||
                        location.startsWith(item.url + "/")
                      }
                    >
                      <Link
                        href={item.url}
                        data-testid={`nav-${item.title
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={user?.profileImageUrl || undefined}
              alt="Profile"
            />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate"
              data-testid="text-user-name"
            >
              {user?.firstName && user?.lastName
                ? `${user.firstName} ${user.lastName}`
                : user?.email || "User"}
            </p>
            <RoleBadge role={primaryRole} className="mt-1" />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => logout()}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
