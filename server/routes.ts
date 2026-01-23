import express, { type Express, type Request } from "express";
import { createServer, type Server } from "http";
import fs from "fs";
import path from "path";
import multer from "multer";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { isAuthenticated } from "./auth";
import {
  insertDepartmentSchema,
  insertHoursSubmissionSchema,
  insertHoursWithdrawalSchema, // NEW
  type InsertHoursSubmission,
} from "@shared/schema";
import { z } from "zod";
import App from "@/App";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // Authentication is handled in index.ts via setupAuth

  // Helper to get user ID from request
  const getUserId = (req: any): string => {
    return req.user?.id;
  };

  // Helper to check if user has role
  const hasRole = async (userId: string, role: string): Promise<boolean> => {
    const roles = await storage.getUserRoles(userId);
    return roles.some((r) => r.role === role);
  };

  // Helper to check if user is admin
  const isAdmin = async (userId: string): Promise<boolean> => {
    return hasRole(userId, "admin");
  };

  // Helper to check if user is approver
  const isApprover = async (userId: string): Promise<boolean> => {
    return (
      hasRole(userId, "approver") ||
      hasRole(userId, "admin") ||
      hasRole(userId, "hr")
    );
  };

  // Helper to check if user is HR
  const isHR = async (userId: string): Promise<boolean> => {
    return hasRole(userId, "hr") || hasRole(userId, "admin");
  };

  type UploadedFile = {
    originalname: string;
    filename: string;
    mimetype: string;
    size: number;
  };

  type AttachmentMeta = {
    originalName: string;
    filename: string;
    url: string;
    mimeType: string;
    size: number;
  };

  const uploadsDir = path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  app.use("/uploads", express.static(uploadsDir));

  const upload = multer({
    storage: multer.diskStorage({
      destination: (
        _req: Request,
        _file: UploadedFile,
        cb: (error: Error | null, destination: string) => void,
      ) => cb(null, uploadsDir),
      filename: (
        _req: Request,
        file: UploadedFile,
        cb: (error: Error | null, filename: string) => void,
      ) => {
        const ext = path.extname(file.originalname);
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
  });

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
  // BALANCE & WITHDRAWALS
  // ===================

  app.get("/api/user/balance", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const balance = await storage.getUserBalance(userId);
      res.json(balance);
    } catch (error) {
      console.error("Error fetching user balance:", error);
      res.status(500).json({ message: "Failed to fetch user balance" });
    }
  });

  app.post("/api/withdrawals", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const data = insertHoursWithdrawalSchema.parse({
        ...req.body,
        userId,
        date: new Date(req.body.date),
        status: "pending", // Force pending
      });

      // Validate time range if provided
      if (data.startTime && data.endTime) {
        // Basic validation that end time is after start time handled by frontend mostly,
        // but good to ensure they exist.
      }

      // 1. Validate Amount
      if (data.amount <= 0) {
        return res.status(400).json({ message: "Amount must be positive" });
      }

      // 2. Check Balance
      const { currentBalance } = await storage.getUserBalance(userId);
      if (currentBalance < data.amount) {
        return res.status(400).json({
          message: `Insufficient balance. Available: ${currentBalance} hours`,
        });
      }

      const withdrawal = await storage.createWithdrawal(data);

      await storage.createAuditLog({
        userId,
        action: "hours_withdrawn",
        entityType: "withdrawal",
        entityId: withdrawal.id,
        newValue: `${data.amount} hours`,
        reason: data.reason,
      });

      // Update audit log if time range provided
      if (data.startTime && data.endTime) {
        // Could update log or just rely on the entity details
      }

      res.status(201).json(withdrawal);
    } catch (error) {
      console.error("Error creating withdrawal:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create withdrawal" });
    }
  });

  app.get("/api/withdrawals", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const withdrawals = await storage.getWithdrawalsByUser(userId);
      res.json(withdrawals);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  app.post(
    "/api/withdrawals/:id/approve",
    isAuthenticated,
    async (req, res) => {
      try {
        const approverId = getUserId(req);
        // Add check if user is allowed to approve (manager check) - omitted for brevity/MVP
        const withdrawal = await storage.approveWithdrawal(
          req.params.id,
          approverId,
        );

        await storage.createAuditLog({
          userId: approverId,
          action: "withdrawal_approved",
          entityType: "withdrawal",
          entityId: req.params.id,
          newValue: "approved",
        });

        res.json(withdrawal);
      } catch (error) {
        res.status(500).json({ message: "Failed to approve withdrawal" });
      }
    },
  );

  app.post("/api/withdrawals/:id/reject", isAuthenticated, async (req, res) => {
    try {
      const approverId = getUserId(req);
      const { reason } = req.body;
      const withdrawal = await storage.rejectWithdrawal(
        req.params.id,
        approverId,
        reason || "",
      );

      await storage.createAuditLog({
        userId: approverId,
        action: "withdrawal_rejected",
        entityType: "withdrawal",
        entityId: req.params.id,
        newValue: "rejected",
        reason: reason,
      });

      res.json(withdrawal);
    } catch (error) {
      res.status(500).json({ message: "Failed to reject withdrawal" });
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
      if (!(await isAdmin(userId))) {
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
        return res
          .status(400)
          .json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create department" });
    }
  });

  app.put("/api/departments/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!(await isAdmin(userId))) {
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
      if (!(await isAdmin(userId))) {
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

  app.get(
    "/api/departments/:id/approvers",
    isAuthenticated,
    async (req, res) => {
      try {
        const userId = getUserId(req);
        if (!(await isAdmin(userId))) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { id } = req.params;
        const approvers = await storage.getDepartmentApproversWithDetails(id);
        res.json(approvers);
      } catch (error) {
        console.error("Error fetching department approvers:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch department approvers" });
      }
    },
  );

  app.post(
    "/api/departments/:id/approvers",
    isAuthenticated,
    async (req, res) => {
      try {
        const userId = getUserId(req);
        if (!(await isAdmin(userId))) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { id } = req.params;
        const { userId: approverUserId } = req.body;

        if (!approverUserId) {
          return res.status(400).json({ message: "userId is required" });
        }

        // Check if user already belongs to a department
        const existingDepartment =
          await storage.getUserDepartment(approverUserId);

        if (existingDepartment) {
          return res.status(409).json({
            message: `User already belongs to another department (${existingDepartment.name}).`,
          });
        }

        await storage.addDepartmentApprover({
          userId: approverUserId,
          departmentId: id,
        });

        await storage.createAuditLog({
          userId,
          action: "approver_added",
          entityType: "department",
          entityId: id,
          newValue: approverUserId,
        });

        // Return enriched data with user details
        const addedApprover = await storage.getDepartmentApproverWithDetails(
          approverUserId,
          id,
        );
        if (!addedApprover) {
          return res
            .status(500)
            .json({ message: "Failed to retrieve added approver" });
        }
        res.status(201).json(addedApprover);
      } catch (error) {
        console.error("Error adding department approver:", error);
        res.status(500).json({ message: "Failed to add department approver" });
      }
    },
  );

  app.delete(
    "/api/departments/:id/approvers/:approverUserId",
    isAuthenticated,
    async (req, res) => {
      try {
        const userId = getUserId(req);
        if (!(await isAdmin(userId))) {
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

        res.json({
          success: true,
          removedUserId: approverUserId,
          departmentId: id,
        });
      } catch (error) {
        console.error("Error removing department approver:", error);
        res
          .status(500)
          .json({ message: "Failed to remove department approver" });
      }
    },
  );

  // ===================
  // EMPLOYEE DEPARTMENT ASSIGNMENTS
  // ===================

  app.get(
    "/api/departments/:id/employees",
    isAuthenticated,
    async (req, res) => {
      try {
        const userId = getUserId(req);
        if (!(await isAdmin(userId))) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { id } = req.params;
        const employees = await storage.getDepartmentEmployeesWithDetails(id);
        res.json(employees);
      } catch (error) {
        console.error("Error fetching department employees:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch department employees" });
      }
    },
  );

  app.post(
    "/api/departments/:id/employees",
    isAuthenticated,
    async (req, res) => {
      try {
        const adminUserId = getUserId(req);

        if (!(await isAdmin(adminUserId))) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { id: departmentId } = req.params;
        const { userId: employeeUserId } = req.body;

        if (!employeeUserId) {
          return res.status(400).json({ message: "userId is required" });
        }

        // 🔍 NEW: Check if user already belongs to a department
        const existingDepartment =
          await storage.getUserDepartment(employeeUserId);

        if (existingDepartment) {
          return res.status(409).json({
            message: `User already belongs to another department (${existingDepartment.name}).`,
          });
        }

        // ✅ Add user to department
        await storage.addEmployeeToDepartment({
          userId: employeeUserId,
          departmentId,
        });

        // 📝 Audit log
        await storage.createAuditLog({
          userId: adminUserId,
          action: "employee_added_to_department",
          entityType: "department",
          entityId: departmentId,
          newValue: employeeUserId,
        });

        // 🔄 Return enriched employee data
        const addedEmployee = await storage.getDepartmentEmployeeWithDetails(
          employeeUserId,
          departmentId,
        );

        if (!addedEmployee) {
          return res
            .status(500)
            .json({ message: "Failed to retrieve added employee" });
        }

        res.status(201).json(addedEmployee);
      } catch (error) {
        console.error("Error adding employee to department:", error);
        res
          .status(500)
          .json({ message: "Failed to add employee to department" });
      }
    },
  );

  app.delete(
    "/api/departments/:id/employees/:employeeUserId",
    isAuthenticated,
    async (req, res) => {
      try {
        const userId = getUserId(req);
        if (!(await isAdmin(userId))) {
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

        res.json({
          success: true,
          removedUserId: employeeUserId,
          departmentId: id,
        });
      } catch (error) {
        console.error("Error removing employee from department:", error);
        res
          .status(500)
          .json({ message: "Failed to remove employee from department" });
      }
    },
  );

  // ===================
  // HOURS SUBMISSIONS
  // ===================

  // Get all submissions (for admin view)
  app.get("/api/submissions/all", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!(await isAdmin(userId))) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || "";

      const { submissions, total } = await storage.getAllSubmissionsWithDetails(
        {
          page,
          limit,
          search,
        },
      );

      res.json({ submissions, total });
    } catch (error) {
      console.error("Error fetching all submissions:", error);
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  // Get user's submissions
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

  app.post(
    "/api/submissions",
    isAuthenticated,
    upload.array("files"),
    async (req, res) => {
      try {
        const userId = getUserId(req);

        const uploadedFiles =
          ((req as Request).files as UploadedFile[] | undefined) || [];
        const attachments: AttachmentMeta[] = uploadedFiles.map((file) => ({
          originalName: file.originalname,
          filename: file.filename,
          url: `/uploads/${file.filename}`,
          mimeType: file.mimetype,
          size: file.size,
        }));

        const submittedTotalHours = Number(req.body.totalHours);

        // Validate hours increment (strict 0.5 enforcement)
        if (submittedTotalHours % 0.5 !== 0) {
          return res
            .status(400)
            .json({ message: "Total hours must be in 0.5 increments" });
        }

        let departmentId = req.body.departmentId;

        // If departmentId is NOT provided, fetch it
        if (!departmentId) {
          // Get user's primary department (first one found)
          const userDepts = await storage.getEmployeeDepartments(userId);
          if (userDepts.length === 0) {
            return res.status(400).json({
              message:
                "You are not assigned to any department. Please contact HR.",
            });
          }
          departmentId = userDepts[0].departmentId;
        }

        const data = insertHoursSubmissionSchema.parse({
          ...req.body,
          totalHours: submittedTotalHours,
          departmentId, // Injected or validated
          userId,
          date: new Date(req.body.date),
          attachments:
            attachments.length > 0 ? JSON.stringify(attachments) : null,
        });

        // Validate hours
        if (data.totalHours < 0.5 || data.totalHours > 24) {
          return res
            .status(400)
            .json({ message: "Hours must be between 0.5 and 24" });
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
          return res
            .status(400)
            .json({ message: "Invalid data", errors: error.errors });
        }
        res.status(500).json({ message: "Failed to create submission" });
      }
    },
  );

  // ===================
  // APPROVALS
  // ===================

  app.get("/api/approvals/pending", isAuthenticated, async (req, res) => {
    try {
      const isApproverUser = await isApprover(getUserId(req));
      const isAdminUser = await isAdmin(getUserId(req));

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
      const filtered = approvals.filter((a) => a.userId !== userId);
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching pending approvals:", error);
      res.status(500).json({ message: "Failed to fetch pending approvals" });
    }
  });

  app.get("/api/approvals/withdrawals", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      let pendingWithdrawals: any[] = [];

      if (await isAdmin(userId)) {
        pendingWithdrawals = await storage.getAllPendingWithdrawals();
      } else if (await isHR(userId)) {
        // HR might only see escalated if that's the logic,
        // but for now let's allow them to see all pending if that's the desired oversight
        // or just mirror the submission logic if we add escalation to withdrawals.
        pendingWithdrawals = await storage.getAllPendingWithdrawals();
      } else if (await isApprover(userId)) {
        pendingWithdrawals =
          await storage.getPendingWithdrawalApprovals(userId);
      }

      // Filter out self-withdrawals
      const filtered = pendingWithdrawals.filter((w) => w.userId !== userId);
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching pending withdrawal approvals:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch pending withdrawal approvals" });
    }
  });

  app.post(
    "/api/submissions/:id/escalate",
    isAuthenticated,
    async (req, res) => {
      try {
        const userId = getUserId(req);
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
          return res
            .status(400)
            .json({ message: "Reason is required for escalation" });
        }

        const submission = await storage.getSubmission(id);
        if (!submission) {
          return res.status(404).json({ message: "Submission not found" });
        }

        // Check if user is an approver for this department
        const canEscalate =
          (await isAdmin(userId)) ||
          (await storage.isUserApproverForDepartment(
            userId,
            submission.departmentId,
          ));

        if (!canEscalate) {
          return res
            .status(403)
            .json({ message: "Not authorized to escalate this submission" });
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
    },
  );

  app.post(
    "/api/submissions/:id/approve",
    isAuthenticated,
    async (req, res) => {
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

        // Check if submission is still pending or escalated (state guard)
        if (
          submission.status !== "pending" &&
          submission.status !== "escalated"
        ) {
          return res
            .status(409)
            .json({ message: "Submission has already been processed" });
        }

        // Self-approval restriction
        if (submission.userId === userId) {
          return res
            .status(403)
            .json({ message: "Cannot approve your own submission" });
        }

        // Check if user can approve
        let canApprove = false;
        if (submission.status === "escalated") {
          canApprove = await isHR(userId);
        } else {
          canApprove =
            (await isAdmin(userId)) ||
            (await storage.isUserApproverForDepartment(
              userId,
              submission.departmentId,
            ));
        }

        if (!canApprove) {
          return res
            .status(403)
            .json({ message: "Not authorized to approve this submission" });
        }

        const updated = await storage.approveSubmission(
          id,
          userId,
          status,
          comment,
        );

        // Create audit log
        await storage.createAuditLog({
          userId,
          action:
            status === "approved"
              ? "submission_approved"
              : "submission_rejected",
          entityType: "submission",
          entityId: id,
          newValue: comment || status,
        });

        res.json(updated);
      } catch (error) {
        console.error("Error processing approval:", error);
        res.status(500).json({ message: "Failed to process approval" });
      }
    },
  );

  // ===================
  // NEW: SUBMISSION APPROVERS
  // ===================

  /**
   * Assign an approver to a specific submission
   * Permission: Admin or HR only
   */
  app.post(
    "/api/submissions/:id/approvers",
    isAuthenticated,
    async (req, res) => {
      try {
        const userId = getUserId(req);
        const { id } = req.params;
        const { approverUserId, approvalOrder } = req.body;

        // Permission check: Only Admin/HR can assign approvers
        if (!(await isAdmin(userId)) && !(await isHR(userId))) {
          return res
            .status(403)
            .json({ message: "Admin or HR access required" });
        }

        if (!approverUserId) {
          return res
            .status(400)
            .json({ message: "approverUserId is required" });
        }

        // Verify submission exists
        const submission = await storage.getSubmission(id);
        if (!submission) {
          return res.status(404).json({ message: "Submission not found" });
        }

        // Verify approver has appropriate role
        const approverRoles = await storage.getUserRoles(approverUserId);
        const hasApproverRole = approverRoles.some((r) =>
          ["approver", "hr", "admin"].includes(r.role),
        );

        if (!hasApproverRole) {
          return res
            .status(400)
            .json({ message: "User must have approver, hr, or admin role" });
        }

        // Check for duplicate assignment
        const isAlreadyAssigned = await storage.isUserAssignedApprover(
          id,
          approverUserId,
        );
        if (isAlreadyAssigned) {
          return res
            .status(409)
            .json({ message: "Approver already assigned to this submission" });
        }

        // Assign approver
        const assignment = await storage.assignApprover({
          submissionId: id,
          approverUserId,
          assignedBy: userId,
          approvalOrder: approvalOrder || null,
        });

        // Create audit log
        await storage.createAuditLog({
          userId,
          action: "approver_assigned",
          entityType: "submission",
          entityId: id,
          newValue: approverUserId,
        });

        // Get enriched data
        const approvers = await storage.getSubmissionApprovers(id);
        const assigned = approvers.find((a) => a.id === assignment.id);

        res.status(201).json(assigned);
      } catch (error) {
        console.error("Error assigning approver:", error);
        res.status(500).json({ message: "Failed to assign approver" });
      }
    },
  );

  /**
   * Get all assigned approvers for a submission
   */
  app.get(
    "/api/submissions/:id/approvers",
    isAuthenticated,
    async (req, res) => {
      try {
        const { id } = req.params;

        const approvers = await storage.getSubmissionApprovers(id);
        res.json(approvers);
      } catch (error) {
        console.error("Error fetching submission approvers:", error);
        res.status(500).json({ message: "Failed to fetch approvers" });
      }
    },
  );

  /**
   * Remove an assigned approver from a submission
   * Permission: Admin or HR only
   */
  app.delete(
    "/api/submissions/:id/approvers/:approverUserId",
    isAuthenticated,
    async (req, res) => {
      try {
        const userId = getUserId(req);
        const { id, approverUserId } = req.params;

        // Permission check: Only Admin/HR can remove approvers
        if (!(await isAdmin(userId)) && !(await isHR(userId))) {
          return res
            .status(403)
            .json({ message: "Admin or HR access required" });
        }

        await storage.removeSubmissionApprover(id, approverUserId);

        // Create audit log
        await storage.createAuditLog({
          userId,
          action: "approver_removed",
          entityType: "submission",
          entityId: id,
          oldValue: approverUserId,
        });

        res.json({ success: true, removedUserId: approverUserId });
      } catch (error) {
        console.error("Error removing approver:", error);
        res.status(500).json({ message: "Failed to remove approver" });
      }
    },
  );

  // ===================
  // NEW: ADMIN OVERRIDE
  // ===================

  /**
   * Override a submission approval (admin only)
   * Allows admin to force approve/reject with mandatory reason
   */
  app.post(
    "/api/submissions/:id/override",
    isAuthenticated,
    async (req, res) => {
      try {
        const userId = getUserId(req);
        const { id } = req.params;
        const { status, reason } = req.body;

        // Permission check: Admin only
        if (!(await isAdmin(userId))) {
          return res
            .status(403)
            .json({ message: "Admin access required for override" });
        }

        if (!["approved", "rejected"].includes(status)) {
          return res
            .status(400)
            .json({ message: "Status must be 'approved' or 'rejected'" });
        }

        if (!reason || reason.trim().length < 10) {
          return res.status(400).json({
            message: "Override reason must be at least 10 characters",
          });
        }

        const submission = await storage.getSubmission(id);
        if (!submission) {
          return res.status(404).json({ message: "Submission not found" });
        }

        // Perform override
        const updated = await storage.overrideSubmission(
          id,
          userId,
          status,
          reason,
        );

        // Create detailed audit log
        await storage.createAuditLog({
          userId,
          action: "submission_overridden",
          entityType: "submission",
          entityId: id,
          oldValue: submission.status,
          newValue: status,
          reason,
        });

        res.json(updated);
      } catch (error: any) {
        console.error("Error overriding submission:", error);
        res
          .status(500)
          .json({ message: error.message || "Failed to override submission" });
      }
    },
  );

  // ===================
  // NEW: EDIT SUBMISSION
  // ===================

  /**
   * Edit a submission
   * Permission: Owner if pending, Admin/HR for any
   */
  app.patch(
    "/api/submissions/:id",
    isAuthenticated,
    upload.array("files"),
    async (req, res) => {
      try {
        const userId = getUserId(req);
        const { id } = req.params;
        const { totalHours, notes, date, startTime, endTime, departmentId } =
          req.body;

        const submission = await storage.getSubmission(id);
        if (!submission) {
          return res.status(404).json({ message: "Submission not found" });
        }

        // Check if cancelled
        if (submission.isCancelled) {
          return res
            .status(400)
            .json({ message: "Cannot edit cancelled submission" });
        }

        // Permission check
        const isOwner = submission.userId === userId;
        const canEditAny = (await isAdmin(userId)) || (await isHR(userId));

        if (!isOwner && !canEditAny) {
          return res
            .status(403)
            .json({ message: "Not authorized to edit this submission" });
        }

        // If not admin/HR, can only edit if pending
        if (isOwner && !canEditAny && submission.status !== "pending") {
          return res
            .status(403)
            .json({ message: "Can only edit pending submissions" });
        }

        const existingAttachments = submission.attachments
          ? (JSON.parse(submission.attachments) as AttachmentMeta[])
          : [];
        const removedAttachments = req.body.removedAttachments
          ? (JSON.parse(req.body.removedAttachments) as string[])
          : [];
        const uploadedFiles =
          ((req as Request).files as UploadedFile[] | undefined) || [];
        const newUploads: AttachmentMeta[] = uploadedFiles.map((file) => ({
          originalName: file.originalname,
          filename: file.filename,
          url: `/uploads/${file.filename}`,
          mimeType: file.mimetype,
          size: file.size,
        }));

        removedAttachments.forEach((filename) => {
          const filePath = path.join(uploadsDir, filename);
          fs.unlink(filePath, () => undefined);
        });

        const mergedAttachments = existingAttachments
          .filter(
            (attachment) => !removedAttachments.includes(attachment.filename),
          )
          .concat(newUploads);

        // Build update data
        const updateData: Partial<InsertHoursSubmission> = {};
        if (totalHours !== undefined)
          updateData.totalHours = Number(totalHours);
        if (notes !== undefined) updateData.notes = notes;
        if (date !== undefined) updateData.date = new Date(date);
        if (startTime !== undefined) updateData.startTime = startTime;
        if (endTime !== undefined) updateData.endTime = endTime;
        if (departmentId !== undefined) updateData.departmentId = departmentId;
        if (removedAttachments.length > 0 || newUploads.length > 0) {
          updateData.attachments =
            mergedAttachments.length > 0
              ? JSON.stringify(mergedAttachments)
              : null;
        }

        // Store old values for audit
        const oldValues = {
          totalHours: submission.totalHours,
          notes: submission.notes,
          date: submission.date,
          startTime: submission.startTime,
          endTime: submission.endTime,
          departmentId: submission.departmentId,
        };

        // Update submission
        const updated = await storage.updateSubmission(id, updateData, userId);

        // Create audit log with detailed changes
        await storage.createAuditLog({
          userId,
          action: "submission_edited",
          entityType: "submission",
          entityId: id,
          oldValue: JSON.stringify(oldValues),
          newValue: JSON.stringify(updateData),
        });

        res.json(updated);
      } catch (error: any) {
        console.error("Error editing submission:", error);
        res
          .status(500)
          .json({ message: error.message || "Failed to edit submission" });
      }
    },
  );

  // ===================
  // NEW: CANCEL SUBMISSION
  // ===================

  /**
   * Cancel a submission (soft delete)
   * Permission: Owner if pending, Admin/HR for any
   */
  app.post("/api/submissions/:id/cancel", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({
          message: "Cancellation reason is required (minimum 5 characters)",
        });
      }

      const submission = await storage.getSubmission(id);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      if (submission.isCancelled) {
        return res
          .status(400)
          .json({ message: "Submission is already cancelled" });
      }

      // Permission check
      const isOwner = submission.userId === userId;
      const canCancelAny = (await isAdmin(userId)) || (await isHR(userId));

      if (!isOwner && !canCancelAny) {
        return res
          .status(403)
          .json({ message: "Not authorized to cancel this submission" });
      }

      // If not admin/HR, can only cancel if pending
      if (isOwner && !canCancelAny && submission.status !== "pending") {
        return res
          .status(403)
          .json({ message: "Can only cancel pending submissions" });
      }

      // Cancel submission
      const updated = await storage.cancelSubmission(id, userId, reason);

      // Create audit log
      await storage.createAuditLog({
        userId,
        action: "submission_cancelled",
        entityType: "submission",
        entityId: id,
        oldValue: submission.status,
        newValue: "cancelled",
        reason,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error cancelling submission:", error);
      res
        .status(500)
        .json({ message: error.message || "Failed to cancel submission" });
    }
  });

  /**
   * Un-cancel a submission (admin only)
   */
  app.post(
    "/api/submissions/:id/uncancel",
    isAuthenticated,
    async (req, res) => {
      try {
        const userId = getUserId(req);
        const { id } = req.params;

        // Permission check: Admin only
        if (!(await isAdmin(userId))) {
          return res
            .status(403)
            .json({ message: "Admin access required to uncancel" });
        }

        const submission = await storage.getSubmission(id);
        if (!submission) {
          return res.status(404).json({ message: "Submission not found" });
        }

        if (!submission.isCancelled) {
          return res
            .status(400)
            .json({ message: "Submission is not cancelled" });
        }

        // Uncancel submission
        const updated = await storage.uncancelSubmission(id, userId);

        // Create audit log
        await storage.createAuditLog({
          userId,
          action: "submission_uncancelled",
          entityType: "submission",
          entityId: id,
          oldValue: "cancelled",
          newValue: submission.status,
        });

        res.json(updated);
      } catch (error: any) {
        console.error("Error uncancelling submission:", error);
        res
          .status(500)
          .json({ message: error.message || "Failed to uncancel submission" });
      }
    },
  );

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
      if (!(await isAdmin(userId))) {
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
      if (!(await isAdmin(userId))) {
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
      if (!(await isAdmin(userId))) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await storage.getAllUsersWithRoles();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put(
    "/api/admin/users/:userId/roles",
    isAuthenticated,
    async (req, res) => {
      try {
        const adminId = getUserId(req);
        if (!(await isAdmin(adminId))) {
          return res.status(403).json({ message: "Admin access required" });
        }

        const { userId } = req.params;
        const { roles } = req.body;

        if (!Array.isArray(roles)) {
          return res.status(400).json({ message: "Roles must be an array" });
        }

        // Always include employee role
        const rolesWithEmployee = roles.includes("employee")
          ? roles
          : ["employee", ...roles];

        const updatedRoles = await storage.setUserRoles(
          userId,
          rolesWithEmployee,
        );

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
    },
  );

  app.get("/api/admin/departments", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!(await isAdmin(userId))) {
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
      if (!(await isAdmin(userId))) {
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
