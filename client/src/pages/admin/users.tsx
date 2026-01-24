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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { RoleBadge } from "@/components/role-badge";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import {
  Users,
  Search,
  Pencil,
  Lock,
  Unlock,
  KeyRound,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { User, Department, UserRole } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

interface UserWithRoles extends User {
  roles: UserRole[];
  departments: Department[];
}

type RoleType = "employee" | "approver" | "admin" | "hr";

export default function ManageUsers() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<RoleType[]>([]);

  // Password Reset State
  const [resetPasswordUser, setResetPasswordUser] =
    useState<UserWithRoles | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data: users, isLoading } = useQuery<UserWithRoles[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  // Update Roles Mutation
  const updateRolesMutation = useMutation({
    mutationFn: async ({
      userId,
      roles,
    }: {
      userId: string;
      roles: RoleType[];
    }) => {
      return apiRequest("PUT", `/api/admin/users/${userId}/roles`, { roles });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User roles updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      handleError(error, "Failed to update user roles.");
    },
  });

  // Toggle Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({
      userId,
      isActive,
    }: {
      userId: string;
      isActive: boolean;
    }) => {
      return apiRequest("PATCH", `/api/users/${userId}/status`, { isActive });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: `User ${variables.isActive ? "activated" : "deactivated"} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      handleError(error, "Failed to update user status.");
    },
  });

  // Reset Password Mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({
      userId,
      password,
    }: {
      userId: string;
      password: string;
    }) => {
      return apiRequest("POST", `/api/users/${userId}/reset-password`, {
        password,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password reset successfully.",
      });
      setResetPasswordUser(null);
      setNewPassword("");
    },
    onError: (error: Error) => {
      handleError(error, "Failed to reset password.");
    },
  });

  const handleError = (error: Error, defaultMsg: string) => {
    if (isUnauthorizedError(error)) {
      toast({
        title: "Unauthorized",
        description: "Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
    toast({
      title: "Error",
      description: error.message || defaultMsg,
      variant: "destructive",
    });
  };

  const filteredUsers = users?.filter((user) => {
    const name = `${user.firstName || ""} ${user.lastName || ""} ${
      user.email || ""
    }`.toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const openEditDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedRoles(user.roles.map((r) => r.role as RoleType));
  };

  const toggleRole = (role: RoleType) => {
    if (role === "employee") return; // Employee is always required
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const saveRoles = () => {
    if (!selectedUser) return;
    updateRolesMutation.mutate({
      userId: selectedUser.id,
      roles: selectedRoles,
    });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser || !newPassword) return;
    resetPasswordMutation.mutate({
      userId: resetPasswordUser.id,
      password: newPassword,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Manage Users</h1>
        <p className="text-muted-foreground">
          View and manage user accounts, status, and password resets.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-lg">Search Users</CardTitle>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-users"
            />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Directory</CardTitle>
          <CardDescription>
            {filteredUsers
              ? `${filteredUsers.length} user${
                  filteredUsers.length !== 1 ? "s" : ""
                } found`
              : "Loading..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={10} columns={5} />
          ) : filteredUsers && filteredUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      User
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Email
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Role
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Departments
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b last:border-0 hover run-elevate"
                      data-testid={`row-user-${user.id}`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage
                              src={user.profileImageUrl || undefined}
                            />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {getInitials(user)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : "No name set"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {user.email || "N/A"}
                      </td>
                      <td className="py-4 px-4">
                        <Badge
                          variant={user.isActive ? "default" : "destructive"}
                          className="capitalize"
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <RoleBadge
                              key={role.id}
                              role={role.role as RoleType}
                            />
                          ))}
                          {user.roles.length === 0 && (
                            <RoleBadge role="employee" />
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground max-w-xs truncate">
                        {user.departments && user.departments.length > 0
                          ? user.departments.map((d) => d.name).join(", ")
                          : "None assigned"}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => openEditDialog(user)}
                              className="gap-2"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit Roles
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setResetPasswordUser(user)}
                              className="gap-2"
                            >
                              <KeyRound className="h-4 w-4" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                toggleStatusMutation.mutate({
                                  userId: user.id,
                                  isActive: !user.isActive,
                                })
                              }
                              disabled={currentUser?.id === user.id}
                              className={
                                user.isActive
                                  ? "text-destructive focus:text-destructive gap-2"
                                  : "text-green-600 focus:text-green-600 gap-2"
                              }
                            >
                              {user.isActive ? (
                                <>
                                  <Lock className="h-4 w-4" /> Deactivate
                                </>
                              ) : (
                                <>
                                  <Unlock className="h-4 w-4" /> Activate
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="No users found"
              description={
                searchQuery
                  ? "No users match your search criteria."
                  : "No users registered yet."
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Edit Roles Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Roles</DialogTitle>
            <DialogDescription>
              Manage roles for {selectedUser?.firstName}{" "}
              {selectedUser?.lastName || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <Checkbox checked disabled />
                <div className="flex-1">
                  <p className="font-medium">Employee</p>
                  <p className="text-sm text-muted-foreground">
                    Base role for all users (cannot be removed)
                  </p>
                </div>
              </div>

              <div
                className="flex items-center gap-3 p-3 rounded-lg border hover-elevate cursor-pointer"
                onClick={() => toggleRole("approver")}
              >
                <Checkbox checked={selectedRoles.includes("approver")} />
                <div className="flex-1">
                  <p className="font-medium">Approver</p>
                  <p className="text-sm text-muted-foreground">
                    Can approve/reject submissions for assigned departments
                  </p>
                </div>
              </div>

              <div
                className="flex items-center gap-3 p-3 rounded-lg border hover-elevate cursor-pointer"
                onClick={() => toggleRole("admin")}
              >
                <Checkbox checked={selectedRoles.includes("admin")} />
                <div className="flex-1">
                  <p className="font-medium">Admin</p>
                  <p className="text-sm text-muted-foreground">
                    Full system access including user and department management
                  </p>
                </div>
              </div>

              <div
                className="flex items-center gap-3 p-3 rounded-lg border hover-elevate cursor-pointer"
                onClick={() => toggleRole("hr")}
              >
                <Checkbox checked={selectedRoles.includes("hr")} />
                <div className="flex-1">
                  <p className="font-medium">HR</p>
                  <p className="text-sm text-muted-foreground">
                    Can view and act only on escalated requests
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={saveRoles}
              disabled={updateRolesMutation.isPending}
              data-testid="button-save-roles"
            >
              {updateRolesMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        open={!!resetPasswordUser}
        onOpenChange={() => {
          setResetPasswordUser(null);
          setNewPassword("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetPasswordUser?.firstName}{" "}
              {resetPasswordUser?.lastName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="new-password" className="text-sm font-medium">
                New Password
              </label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                minLength={6}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetPasswordUser(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={resetPasswordMutation.isPending}>
                {resetPasswordMutation.isPending
                  ? "Resetting..."
                  : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
