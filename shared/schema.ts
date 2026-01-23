import { sql, relations } from "drizzle-orm";
import {
  mysqlTable,
  text,
  varchar,
  timestamp,
  double,
  boolean,
  mysqlEnum,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";
import { users } from "./models/auth";

// Departments table
export const departments = mysqlTable("departments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 191 }).notNull().unique(),

  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User roles - allows multi-role support
export const userRoles = mysqlTable("user_roles", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  role: mysqlEnum("role", ["employee", "approver", "admin", "hr"])
    .notNull()
    .default("employee"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Employee-Department assignments
export const employeeDepartments = mysqlTable("employee_departments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  departmentId: varchar("department_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Department approvers
export const departmentApprovers = mysqlTable("department_approvers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  departmentId: varchar("department_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Hours submissions
export const hoursSubmissions = mysqlTable("hours_submissions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  departmentId: varchar("department_id", { length: 36 }).notNull(),
  date: timestamp("date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  totalHours: double("total_hours").notNull(),
  notes: text("notes"),
  attachments: text("attachments"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "escalated"])
    .notNull()
    .default("pending"),
  approvedBy: varchar("approved_by", { length: 36 }),
  approvedAt: timestamp("approved_at"),
  approverComment: text("approver_comment"),
  escalatedAt: timestamp("escalated_at"),
  escalationReason: text("escalation_reason"),

  // NEW: Admin Override fields
  isOverridden: boolean("is_overridden").default(false), // Indicates if this was overridden by admin
  overriddenBy: varchar("overridden_by", { length: 36 }), // Admin who performed override
  overriddenAt: timestamp("overridden_at"), // When override occurred
  overrideReason: text("override_reason"), // Mandatory reason for override

  // NEW: Cancellation fields
  isCancelled: boolean("is_cancelled").default(false), // Soft delete flag
  cancelledBy: varchar("cancelled_by", { length: 36 }), // Who cancelled
  cancelledAt: timestamp("cancelled_at"), // When cancelled
  cancellationReason: text("cancellation_reason"), // Mandatory reason for cancellation

  // NEW: Edit tracking fields
  editCount: double("edit_count").default(0), // Number of times edited
  lastEditedBy: varchar("last_edited_by", { length: 36 }), // Last editor
  lastEditedAt: timestamp("last_edited_at"), // Last edit timestamp

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").onUpdateNow(),
});

// Audit log
export const auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id", { length: 36 }),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  reason: text("reason"), // NEW: Optional reason for the action
  ipAddress: varchar("ip_address", { length: 45 }), // NEW: IP address of the actor
  userAgent: text("user_agent"), // NEW: User agent string
  createdAt: timestamp("created_at").defaultNow(),
});

// NEW: Submission Approvers - Explicit approver assignment
// Allows assigning specific approvers to individual submissions
// If no approvers are assigned, falls back to department-based approval (backward compatible)
export const submissionApprovers = mysqlTable("submission_approvers", {
  id: varchar("id", { length: 36 }).primaryKey(),
  submissionId: varchar("submission_id", { length: 36 }).notNull(),
  approverUserId: varchar("approver_user_id", { length: 36 }).notNull(),
  assignedBy: varchar("assigned_by", { length: 36 }).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
  approvalOrder: double("approval_order"), // Optional: for sequential approval workflows
  createdAt: timestamp("created_at").defaultNow(),
});

// NEW: Hours Withdrawals table
export const hoursWithdrawals = mysqlTable("hours_withdrawals", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  amount: double("amount").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  reason: text("reason"),
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const departmentsRelations = relations(departments, ({ many }) => ({
  employeeDepartments: many(employeeDepartments),
  departmentApprovers: many(departmentApprovers),
  hoursSubmissions: many(hoursSubmissions),
}));

export const userRolesRelations = relations(userRoles, ({}) => ({}));

export const employeeDepartmentsRelations = relations(
  employeeDepartments,
  ({ one }) => ({
    department: one(departments, {
      fields: [employeeDepartments.departmentId],
      references: [departments.id],
    }),
  }),
);

export const departmentApproversRelations = relations(
  departmentApprovers,
  ({ one }) => ({
    department: one(departments, {
      fields: [departmentApprovers.departmentId],
      references: [departments.id],
    }),
  }),
);

export const hoursSubmissionsRelations = relations(
  hoursSubmissions,
  ({ one }) => ({
    department: one(departments, {
      fields: [hoursSubmissions.departmentId],
      references: [departments.id],
    }),
  }),
);

// NEW: Submission Approvers Relations
export const submissionApproversRelations = relations(
  submissionApprovers,
  ({ one }) => ({
    submission: one(hoursSubmissions, {
      fields: [submissionApprovers.submissionId],
      references: [hoursSubmissions.id],
    }),
  }),
);

export const hoursWithdrawalsRelations = relations(
  hoursWithdrawals,
  ({ one }) => ({
    user: one(users, {
      fields: [hoursWithdrawals.userId],
      references: [users.id],
    }),
  }),
);

// Insert schemas
export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
});
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  createdAt: true,
});
export const insertEmployeeDepartmentSchema = createInsertSchema(
  employeeDepartments,
).omit({ id: true, createdAt: true });
export const insertDepartmentApproverSchema = createInsertSchema(
  departmentApprovers,
).omit({ id: true, createdAt: true });
export const insertHoursSubmissionSchema = createInsertSchema(
  hoursSubmissions,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  approvedBy: true,
  approvedAt: true,
  approverComment: true,
});
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

// NEW: Submission Approvers schema
export const insertSubmissionApproverSchema = createInsertSchema(
  submissionApprovers,
).omit({
  id: true,
  createdAt: true,
  assignedAt: true,
});

export const insertHoursWithdrawalSchema = createInsertSchema(
  hoursWithdrawals,
).omit({
  id: true,
  createdAt: true,
});

// Types
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;

export type EmployeeDepartment = typeof employeeDepartments.$inferSelect;
export type InsertEmployeeDepartment = z.infer<
  typeof insertEmployeeDepartmentSchema
>;

export type DepartmentApprover = typeof departmentApprovers.$inferSelect;
export type InsertDepartmentApprover = z.infer<
  typeof insertDepartmentApproverSchema
>;

export type HoursSubmission = typeof hoursSubmissions.$inferSelect;
export type InsertHoursSubmission = z.infer<typeof insertHoursSubmissionSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// NEW: Submission Approver types
export type SubmissionApprover = typeof submissionApprovers.$inferSelect;
export type InsertSubmissionApprover = z.infer<
  typeof insertSubmissionApproverSchema
>;

export type HoursWithdrawal = typeof hoursWithdrawals.$inferSelect;
export type InsertHoursWithdrawal = z.infer<typeof insertHoursWithdrawalSchema>;
