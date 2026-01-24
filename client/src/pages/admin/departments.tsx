import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { format } from "date-fns";
import { Building2, Plus, Pencil, Trash2, Users, Shield } from "lucide-react";
import type { Department, User } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required").max(100),
  description: z.string().max(500).optional(),
});

type DepartmentFormData = z.infer<typeof departmentSchema>;

interface DepartmentWithStats extends Department {
  employeeCount: number;
  approverCount: number;
}

export default function ManageDepartments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(
    null,
  );
  const [deletingDepartment, setDeletingDepartment] =
    useState<Department | null>(null);

  const { data: departments, isLoading } = useQuery<DepartmentWithStats[]>({
    queryKey: ["/api/admin/departments"],
  });

  const { data: allUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const [managingUsers, setManagingUsers] = useState<{
    type: "approvers" | "employees";
    department: Department;
  } | null>(null);

  const { data: departmentUsers, isLoading: isLoadingDeptUsers } = useQuery<
    any[]
  >({
    queryKey: [
      `/api/departments/${managingUsers?.department.id}/${managingUsers?.type}`,
    ],
    enabled: !!managingUsers,
  });

  const addUserMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const path =
        managingUsers?.type === "approvers" ? "approvers" : "employees";
      return apiRequest(
        "POST",
        `/api/departments/${managingUsers?.department.id}/${path}`,
        { userId },
      );
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User added successfully." });
      queryClient.invalidateQueries({
        queryKey: [
          `/api/departments/${managingUsers?.department.id}/${managingUsers?.type}`,
        ],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/departments"] });
    },
    onError: (error: Error) => {
      const parsed = JSON.parse(error.message.replace(/^\d+:\s*/, ""));
      const message = parsed.message;
      toast({
        title: "Error",
        description: message || "Failed to add user.",
        variant: "destructive",
      });
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const path =
        managingUsers?.type === "approvers" ? "approvers" : "employees";
      return apiRequest(
        "DELETE",
        `/api/departments/${managingUsers?.department.id}/${path}/${userId}`,
      );
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User removed successfully." });
      queryClient.invalidateQueries({
        queryKey: [
          `/api/departments/${managingUsers?.department.id}/${managingUsers?.type}`,
        ],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/departments"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to remove user.",
        variant: "destructive",
      });
    },
  });

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: DepartmentFormData) => {
      return apiRequest("POST", "/api/departments", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Department created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
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
        description: "Failed to create department. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: DepartmentFormData;
    }) => {
      return apiRequest("PUT", `/api/departments/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Department updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setEditingDepartment(null);
      form.reset();
    },
    onError: (error: Error) => {
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
        description: "Failed to update department. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/departments/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Department deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setDeletingDepartment(null);
    },
    onError: (error: Error) => {
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
        description:
          "Failed to delete department. It may have associated records.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DepartmentFormData) => {
    if (editingDepartment) {
      updateMutation.mutate({ id: editingDepartment.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (department: Department) => {
    setEditingDepartment(department);
    form.reset({
      name: department.name,
      description: department.description || "",
    });
  };

  const closeDialog = () => {
    setIsCreateOpen(false);
    setEditingDepartment(null);
    form.reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Manage Departments</h1>
          <p className="text-muted-foreground">
            Create and manage organizational departments
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-department">
              <Plus className="h-4 w-4" />
              Create Department
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Department</DialogTitle>
              <DialogDescription>
                Add a new department to your organization
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Engineering"
                          {...field}
                          data-testid="input-department-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of this department..."
                          {...field}
                          data-testid="textarea-department-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-save-department"
                  >
                    {createMutation.isPending
                      ? "Creating..."
                      : "Create Department"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Departments</CardTitle>
          <CardDescription>
            {departments
              ? `${departments.length} department${
                  departments.length !== 1 ? "s" : ""
                } configured`
              : "Loading..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={5} columns={5} />
          ) : departments && departments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Department
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Description
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Employees
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Approvers
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Created
                    </th>
                    <th className="py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((department) => (
                    <tr
                      key={department.id}
                      className="border-b last:border-0 hover-elevate"
                      data-testid={`row-department-${department.id}`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <span className="font-medium">{department.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground max-w-xs truncate">
                        {department.description || "-"}
                      </td>
                      <td className="py-4 px-4 font-mono text-sm">
                        {department.employeeCount}
                      </td>
                      <td className="py-4 px-4 font-mono text-sm">
                        {department.approverCount}
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {format(
                          new Date(department.createdAt!),
                          "MMM dd, yyyy",
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setManagingUsers({
                                type: "approvers",
                                department,
                              })
                            }
                            title="Manage Approvers"
                            data-testid={`button-manage-approvers-${department.id}`}
                          >
                            <Shield className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setManagingUsers({
                                type: "employees",
                                department,
                              })
                            }
                            title="Manage Employees"
                            data-testid={`button-manage-employees-${department.id}`}
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditDialog(department)}
                            data-testid={`button-edit-department-${department.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletingDepartment(department)}
                            data-testid={`button-delete-department-${department.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
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
              icon={Building2}
              title="No departments yet"
              description="Create your first department to start organizing employees and approvals."
              action={{
                label: "Create Department",
                onClick: () => setIsCreateOpen(true),
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingDepartment}
        onOpenChange={() => setEditingDepartment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>Update department information</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="input-edit-department-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        data-testid="textarea-edit-department-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-update-department"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Manage Users Dialog */}
      <Dialog
        open={!!managingUsers}
        onOpenChange={() => setManagingUsers(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Manage{" "}
              {managingUsers?.type === "approvers" ? "Approvers" : "Employees"}{" "}
              - {managingUsers?.department.name}
            </DialogTitle>
            <DialogDescription>
              Assign or remove{" "}
              {managingUsers?.type === "approvers" ? "approvers" : "employees"}{" "}
              for this department.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h3 className="text-sm font-medium">
                Add New{" "}
                {managingUsers?.type === "approvers" ? "Approver" : "Employee"}
              </h3>
              <div className="flex gap-2">
                <Select
                  onValueChange={(userId) => addUserMutation.mutate({ userId })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a user to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers
                      ?.filter((user) => {
                        const userDepartments = (user as any).departments || [];
                        const isAssignedToThis = departmentUsers?.some(
                          (du) => du.userId === user.id,
                        );
                        const isAssignedToAny = userDepartments.length > 0;

                        // Exclude if assigned to ANY department (enforce 1:1)
                        // Unless it's this department (though UI handles duplicates usually, cleaner to exclude)
                        return !isAssignedToThis && !isAssignedToAny;
                      })
                      .map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName} ({user.email})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium">
                Current{" "}
                {managingUsers?.type === "approvers"
                  ? "Approvers"
                  : "Employees"}
              </h3>
              {isLoadingDeptUsers ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-12 bg-muted animate-pulse rounded-md"
                    />
                  ))}
                </div>
              ) : departmentUsers && departmentUsers.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {departmentUsers.map((du) => (
                    <div
                      key={du.id}
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {du.user?.firstName} {du.user?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {du.user?.email}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-8 w-8 p-0"
                        onClick={() => removeUserMutation.mutate(du.userId)}
                        disabled={removeUserMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No users assigned yet.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setManagingUsers(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
