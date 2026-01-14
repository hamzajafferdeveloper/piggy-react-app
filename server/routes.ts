import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./auth";
import { insertDepartmentSchema, insertHoursSubmissionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Authentication is handled in index.ts via setupAuth

  // Helper to get user ID from request
  const getUserId = (req: any): string => {
    return req.user?.id;
  };


  // Helper to check if user has role
  const hasRole = async (userId: string, role: string): Promise<boolean> => {
    const roles = await storage.getUserRoles(userId);
    return roles.some(r => r.role === role);
  };

  // Helper to check if user is admin
  const isAdmin = async (userId: string): Promise<boolean> => {
    return hasRole(userId, "admin");
  };

  // Helper to check if user is approver
  const isApprover = async (userId: string): Promise<boolean> => {
    return hasRole(userId, "approver") || hasRole(userId, "admin") || hasRole(userId, "hr");
  };

  // Helper to check if user is HR
  const isHR = async (userId: string): Promise<boolean> => {
    return hasRole(userId, "hr") || hasRole(userId, "admin");
  };

  // ===================
  // USER ROLES
  // ===================

  app.get("/api/user/roles", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      let roles = await storage.getUserRoles(userId);
      
      // If no roles, assign default employee role
      if (roles.length === 0) {
        await storage.addUserRole({ userId, role: "employee" });
        roles = await storage.getUserRoles(userId);
      }
      
      res.json(roles);
    } catch (error) {
      console.error("Error fetching user roles:", error);
      res.status(500).json({ message: "Failed to fetch user roles" });
    }
  });

  // ===================
  // DEPARTMENTS
  // ===================

  app.get("/api/departments", isAuthenticated, async (req, res) => {
    try {
      const departments = await storage.getDepartments();
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  app.post("/api/departments", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!await isAdmin(userId)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const data = insertDepartmentSchema.parse(req.body);
      const department = await storage.createDepartment(data);
      
      // Create audit log
      await storage.createAuditLog({
        userId,
        action: "department_created",
        entityType: "department",
        entityId: department.id,
        newValue: department.name,
      });
      
      res.status(201).json(department);
    } catch (error) {
      console.error("Error creating department:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create department" });
    }
  });

  app.put("/api/departments/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!await isAdmin(userId)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const existing = await storage.getDepartment(id);
      if (!existing) {
        return res.status(404).json({ message: "Department not found" });
      }

      const data = insertDepartmentSchema.partial().parse(req.body);
      const department = await storage.updateDepartment(id, data);
      
      // Create audit log
      await storage.createAuditLog({
        userId,
        action: "department_updated",
        entityType: "department",
        entityId: id,
        oldValue: existing.name,
        newValue: data.name || existing.name,
      });
      
      res.json(department);
    } catch (error) {
      console.error("Error updating department:", error);
      res.status(500).json({ message: "Failed to update department" });
    }
  });

  app.delete("/api/departments/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!await isAdmin(userId)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const existing = await storage.getDepartment(id);
      if (!existing) {
        return res.status(404).json({ message: "Department not found" });
      }

      await storage.deleteDepartment(id);
      
      // Create audit log
      await storage.createAuditLog({
        userId,
        action: "department_deleted",
        entityType: "department",
        entityId: id,
        oldValue: existing.name,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting department:", error);
      res.status(500).json({ message: "Failed to delete department" });
    }
  });

  // ===================
  // DEPARTMENT APPROVERS
  // ===================

  app.get("/api/departments/:id/approvers", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!await isAdmin(userId)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const approvers = await storage.getDepartmentApproversWithDetails(id);
      res.json(approvers);
    } catch (error) {
      console.error("Error fetching department approvers:", error);
      res.status(500).json({ message: "Failed to fetch department approvers" });
    }
  });

  app.post("/api/departments/:id/approvers", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!await isAdmin(userId)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { userId: approverUserId } = req.body;
      
      if (!approverUserId) {
        return res.status(400).json({ message: "userId is required" });
      }

      await storage.addDepartmentApprover({ userId: approverUserId, departmentId: id });
      
      await storage.createAuditLog({
        userId,
        action: "approver_added",
        entityType: "department",
        entityId: id,
        newValue: approverUserId,
      });
      
      // Return enriched data with user details
      const addedApprover = await storage.getDepartmentApproverWithDetails(approverUserId, id);
      if (!addedApprover) {
        return res.status(500).json({ message: "Failed to retrieve added approver" });
      }
      res.status(201).json(addedApprover);
    } catch (error) {
      console.error("Error adding department approver:", error);
      res.status(500).json({ message: "Failed to add department approver" });
    }
  });

  app.delete("/api/departments/:id/approvers/:approverUserId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!await isAdmin(userId)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id, approverUserId } = req.params;
      await storage.removeDepartmentApprover(approverUserId, id);
      
      await storage.createAuditLog({
        userId,
        action: "approver_removed",
        entityType: "department",
        entityId: id,
        oldValue: approverUserId,
      });
      
      res.json({ success: true, removedUserId: approverUserId, departmentId: id });
    } catch (error) {
      console.error("Error removing department approver:", error);
      res.status(500).json({ message: "Failed to remove department approver" });
    }
  });

  // ===================
  // EMPLOYEE DEPARTMENT ASSIGNMENTS
  // ===================

  app.get("/api/departments/:id/employees", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!await isAdmin(userId)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const employees = await storage.getDepartmentEmployeesWithDetails(id);
      res.json(employees);
    } catch (error) {
      console.error("Error fetching department employees:", error);
      res.status(500).json({ message: "Failed to fetch department employees" });
    }
  });

  app.post("/api/departments/:id/employees", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!await isAdmin(userId)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { userId: employeeUserId } = req.body;
      
      if (!employeeUserId) {
        return res.status(400).json({ message: "userId is required" });
      }

      await storage.addEmployeeToDepartment({ userId: employeeUserId, departmentId: id });
      
      await storage.createAuditLog({
        userId,
        action: "employee_added_to_department",
        entityType: "department",
        entityId: id,
        newValue: employeeUserId,
      });
      
      // Return enriched data with user details
      const addedEmployee = await storage.getDepartmentEmployeeWithDetails(employeeUserId, id);
      if (!addedEmployee) {
        return res.status(500).json({ message: "Failed to retrieve added employee" });
      }
      res.status(201).json(addedEmployee);
    } catch (error) {
      console.error("Error adding employee to department:", error);
      res.status(500).json({ message: "Failed to add employee to department" });
    }
  });

  app.delete("/api/departments/:id/employees/:employeeUserId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!await isAdmin(userId)) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id, employeeUserId } = req.params;
      await storage.removeEmployeeFromDepartment(employeeUserId, id);
      
      await storage.createAuditLog({
        userId,
        action: "employee_removed_from_department",
        entityType: "department",
        entityId: id,
        oldValue: employeeUserId,
      });
      
      res.json({ success: true, removedUserId: employeeUserId, departmentId: id });
    } catch (error) {
      console.error("Error removing employee from department:", error);
      res.status(500).json({ message: "Failed to remove employee from department" });
    }
  });

  // ===================
  // HOURS SUBMISSIONS
  // ===================

  app.get("/api/submissions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const submissions = await storage.getSubmissionsWithDetails(userId);
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  app.post("/api/submissions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      const data = insertHoursSubmissionSchema.parse({
        ...req.body,
        userId,
        date: new Date(req.body.date),
      });
      
      // Validate hours
      if (data.totalHours < 0.5 || data.totalHours > 24) {
        return res.status(400).json({ message: "Hours must be between 0.5 and 24" });
      }
      
      const submission = await storage.createSubmission(data);
      
      // Create audit log
      await storage.createAuditLog({
        userId,
        action: "submission_created",
        entityType: "submission",
        entityId: submission.id,
        newValue: `${data.totalHours} hours`,
      });
      
      res.status(201).json(submission);
    } catch (error) {
      console.error("Error creating submission:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create submission" });
    }
  });

  // ===================
  // APPROVALS
  // ===================

  app.get("/api/approvals/pending", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      // Trigger auto-escalation check
      await storage.autoEscalateSubmissions();

      let approvals: any[] = [];
      
      if (await isAdmin(userId)) {
        const pending = await storage.getAllPendingApprovals();
        const escalated = await storage.getEscalatedApprovals();
        approvals = [...pending, ...escalated];
      } else if (await isHR(userId)) {
        approvals = await storage.getEscalatedApprovals();
      } else if (await isApprover(userId)) {
        approvals = await storage.getPendingApprovals(userId);
      }
      
      // Filter out self-submissions
      const filtered = approvals.filter(a => a.userId !== userId);
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      res.status(500).json({ message: "Failed to fetch pending approvals" });
    }
  });

  app.post("/api/submissions/:id/escalate", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const { reason } = req.body;
      
      if (!reason) {
        return res.status(400).json({ message: "Reason is required for escalation" });
      }
      
      const submission = await storage.getSubmission(id);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }
      
      // Check if user is an approver for this department
      const canEscalate = await isAdmin(userId) || 
        await storage.isUserApproverForDepartment(userId, submission.departmentId);
      
      if (!canEscalate) {
        return res.status(403).json({ message: "Not authorized to escalate this submission" });
      }
      
      const updated = await storage.escalateSubmission(id, reason);
      
      await storage.createAuditLog({
        userId,
        action: "submission_escalated",
        entityType: "submission",
        entityId: id,
        newValue: reason,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error escalating submission:", error);
      res.status(500).json({ message: "Failed to escalate submission" });
    }
  });

  app.post("/api/submissions/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const { status, comment } = req.body;
      
      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const submission = await storage.getSubmission(id);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }
      
      // Check if submission is still pending (state guard)
      if (submission.status !== "pending") {
        return res.status(409).json({ message: "Submission has already been processed" });
      }
      
      // Self-approval restriction
      if (submission.userId === userId) {
        return res.status(403).json({ message: "Cannot approve your own submission" });
      }
      
      // Check if user can approve
      let canApprove = false;
      if (submission.status === "escalated") {
        canApprove = await isHR(userId);
      } else {
        canApprove = await isAdmin(userId) || 
          await storage.isUserApproverForDepartment(userId, submission.departmentId);
      }
      
      if (!canApprove) {
        return res.status(403).json({ message: "Not authorized to approve this submission" });
      }
      
      const updated = await storage.approveSubmission(id, userId, status, comment);
      
      // Create audit log
      await storage.createAuditLog({
        userId,
        action: status === "approved" ? "submission_approved" : "submission_rejected",
        entityType: "submission",
        entityId: id,
        newValue: comment || status,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error processing approval:", error);
      res.status(500).json({ message: "Failed to process approval" });
    }
  });

  // ===================
  // DASHBOARD STATS
  // ===================

  app.get("/api/dashboard/stats", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const stats = await storage.getDashboardStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // ===================
  // ADMIN ROUTES
  // ===================

  app.get("/api/admin/stats", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!await isAdmin(userId)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  app.get("/api/admin/recent-activity", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!await isAdmin(userId)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const activity = await storage.getRecentSubmissions(10);
      res.json(activity);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      res.status(500).json({ message: "Failed to fetch recent activity" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!await isAdmin(userId)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const users = await storage.getAllUsersWithRoles();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:userId/roles", isAuthenticated, async (req, res) => {
    try {
      const adminId = getUserId(req);
      if (!await isAdmin(adminId)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { userId } = req.params;
      const { roles } = req.body;
      
      if (!Array.isArray(roles)) {
        return res.status(400).json({ message: "Roles must be an array" });
      }
      
      // Always include employee role
      const rolesWithEmployee = roles.includes("employee") ? roles : ["employee", ...roles];
      
      const updatedRoles = await storage.setUserRoles(userId, rolesWithEmployee);
      
      // Create audit log
      await storage.createAuditLog({
        userId: adminId,
        action: "user_role_updated",
        entityType: "user",
        entityId: userId,
        newValue: rolesWithEmployee.join(", "),
      });
      
      res.json(updatedRoles);
    } catch (error) {
      console.error("Error updating user roles:", error);
      res.status(500).json({ message: "Failed to update user roles" });
    }
  });

  app.get("/api/admin/departments", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!await isAdmin(userId)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const departments = await storage.getDepartmentsWithStats();
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments with stats:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  app.get("/api/admin/audit", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!await isAdmin(userId)) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const logs = await storage.getAuditLogs(200);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  return httpServer;
}
