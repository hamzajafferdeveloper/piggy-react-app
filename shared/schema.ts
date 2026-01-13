import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, real, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// Enums
export const userRoleEnum = pgEnum("user_role", ["employee", "approver", "admin"]);
export const submissionStatusEnum = pgEnum("submission_status", ["pending", "approved", "rejected"]);

// Departments table
export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User roles - allows multi-role support
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  role: userRoleEnum("role").notNull().default("employee"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Employee-Department assignments
export const employeeDepartments = pgTable("employee_departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  departmentId: varchar("department_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Department approvers
export const departmentApprovers = pgTable("department_approvers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  departmentId: varchar("department_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Hours submissions
export const hoursSubmissions = pgTable("hours_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  departmentId: varchar("department_id").notNull(),
  date: timestamp("date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  totalHours: real("total_hours").notNull(),
  notes: text("notes"),
  status: submissionStatusEnum("status").notNull().default("pending"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  approverComment: text("approver_comment"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audit log
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const departmentsRelations = relations(departments, ({ many }) => ({
  employeeDepartments: many(employeeDepartments),
  departmentApprovers: many(departmentApprovers),
  hoursSubmissions: many(hoursSubmissions),
}));

export const userRolesRelations = relations(userRoles, ({ }) => ({}));

export const employeeDepartmentsRelations = relations(employeeDepartments, ({ one }) => ({
  department: one(departments, {
    fields: [employeeDepartments.departmentId],
    references: [departments.id],
  }),
}));

export const departmentApproversRelations = relations(departmentApprovers, ({ one }) => ({
  department: one(departments, {
    fields: [departmentApprovers.departmentId],
    references: [departments.id],
  }),
}));

export const hoursSubmissionsRelations = relations(hoursSubmissions, ({ one }) => ({
  department: one(departments, {
    fields: [hoursSubmissions.departmentId],
    references: [departments.id],
  }),
}));

// Insert schemas
export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true });
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({ id: true, createdAt: true });
export const insertEmployeeDepartmentSchema = createInsertSchema(employeeDepartments).omit({ id: true, createdAt: true });
export const insertDepartmentApproverSchema = createInsertSchema(departmentApprovers).omit({ id: true, createdAt: true });
export const insertHoursSubmissionSchema = createInsertSchema(hoursSubmissions).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  status: true,
  approvedBy: true,
  approvedAt: true,
  approverComment: true,
});
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });

// Types
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;

export type EmployeeDepartment = typeof employeeDepartments.$inferSelect;
export type InsertEmployeeDepartment = z.infer<typeof insertEmployeeDepartmentSchema>;

export type DepartmentApprover = typeof departmentApprovers.$inferSelect;
export type InsertDepartmentApprover = z.infer<typeof insertDepartmentApproverSchema>;

export type HoursSubmission = typeof hoursSubmissions.$inferSelect;
export type InsertHoursSubmission = z.infer<typeof insertHoursSubmissionSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
