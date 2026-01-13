import {
  departments,
  userRoles,
  employeeDepartments,
  departmentApprovers,
  hoursSubmissions,
  auditLogs,
  type Department,
  type InsertDepartment,
  type UserRole,
  type InsertUserRole,
  type EmployeeDepartment,
  type InsertEmployeeDepartment,
  type DepartmentApprover,
  type InsertDepartmentApprover,
  type HoursSubmission,
  type InsertHoursSubmission,
  type AuditLog,
  type InsertAuditLog,
  users,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Departments
  getDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department | undefined>;
  createDepartment(data: InsertDepartment): Promise<Department>;
  updateDepartment(id: string, data: Partial<InsertDepartment>): Promise<Department | undefined>;
  deleteDepartment(id: string): Promise<boolean>;
  getDepartmentsWithStats(): Promise<(Department & { employeeCount: number; approverCount: number })[]>;

  // User Roles
  getUserRoles(userId: string): Promise<UserRole[]>;
  setUserRoles(userId: string, roles: string[]): Promise<UserRole[]>;
  addUserRole(data: InsertUserRole): Promise<UserRole>;
  removeUserRole(userId: string, role: string): Promise<boolean>;

  // Employee Departments
  getEmployeeDepartments(userId: string): Promise<EmployeeDepartment[]>;
  getDepartmentEmployeesWithDetails(departmentId: string): Promise<any[]>;
  getDepartmentEmployeeWithDetails(userId: string, departmentId: string): Promise<any | null>;
  addEmployeeToDepartment(data: InsertEmployeeDepartment): Promise<EmployeeDepartment>;
  removeEmployeeFromDepartment(userId: string, departmentId: string): Promise<boolean>;

  // Department Approvers
  getDepartmentApproversWithDetails(departmentId: string): Promise<any[]>;
  getDepartmentApproverWithDetails(userId: string, departmentId: string): Promise<any | null>;
  isUserApproverForDepartment(userId: string, departmentId: string): Promise<boolean>;
  addDepartmentApprover(data: InsertDepartmentApprover): Promise<DepartmentApprover>;
  removeDepartmentApprover(userId: string, departmentId: string): Promise<boolean>;

  // Hours Submissions
  createSubmission(data: InsertHoursSubmission): Promise<HoursSubmission>;
  getSubmission(id: string): Promise<HoursSubmission | undefined>;
  getSubmissionsByUser(userId: string): Promise<HoursSubmission[]>;
  getSubmissionsWithDetails(userId?: string): Promise<any[]>;
  getPendingApprovals(approverId: string): Promise<any[]>;
  getAllPendingApprovals(): Promise<any[]>;
  approveSubmission(id: string, approverId: string, status: "approved" | "rejected", comment?: string): Promise<HoursSubmission | undefined>;
  getRecentSubmissions(limit?: number): Promise<any[]>;

  // Stats
  getDashboardStats(userId: string): Promise<{ totalHoursSubmitted: number; pendingCount: number; approvedThisMonth: number }>;
  getAdminStats(): Promise<{ totalEmployees: number; totalDepartments: number; pendingApprovals: number; hoursThisMonth: number }>;

  // Audit Logs
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(limit?: number): Promise<any[]>;

  // Users
  getAllUsersWithRoles(): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // Departments
  async getDepartments(): Promise<Department[]> {
    return db.select().from(departments).orderBy(departments.name);
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    const [dept] = await db.select().from(departments).where(eq(departments.id, id));
    return dept;
  }

  async createDepartment(data: InsertDepartment): Promise<Department> {
    const [dept] = await db.insert(departments).values(data).returning();
    return dept;
  }

  async updateDepartment(id: string, data: Partial<InsertDepartment>): Promise<Department | undefined> {
    const [dept] = await db.update(departments).set(data).where(eq(departments.id, id)).returning();
    return dept;
  }

  async deleteDepartment(id: string): Promise<boolean> {
    const result = await db.delete(departments).where(eq(departments.id, id));
    return true;
  }

  async getDepartmentsWithStats(): Promise<(Department & { employeeCount: number; approverCount: number })[]> {
    const depts = await this.getDepartments();
    const result = await Promise.all(depts.map(async (dept) => {
      const employees = await db.select().from(employeeDepartments).where(eq(employeeDepartments.departmentId, dept.id));
      const approvers = await db.select().from(departmentApprovers).where(eq(departmentApprovers.departmentId, dept.id));
      return {
        ...dept,
        employeeCount: employees.length,
        approverCount: approvers.length,
      };
    }));
    return result;
  }

  // User Roles
  async getUserRoles(userId: string): Promise<UserRole[]> {
    return db.select().from(userRoles).where(eq(userRoles.userId, userId));
  }

  async setUserRoles(userId: string, roles: string[]): Promise<UserRole[]> {
    // Delete existing roles
    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    
    // Insert new roles
    if (roles.length > 0) {
      await db.insert(userRoles).values(
        roles.map(role => ({ userId, role: role as "employee" | "approver" | "admin" }))
      );
    }
    
    return this.getUserRoles(userId);
  }

  async addUserRole(data: InsertUserRole): Promise<UserRole> {
    const [role] = await db.insert(userRoles).values(data).returning();
    return role;
  }

  async removeUserRole(userId: string, role: string): Promise<boolean> {
    await db.delete(userRoles).where(
      and(eq(userRoles.userId, userId), eq(userRoles.role, role as "employee" | "approver" | "admin"))
    );
    return true;
  }

  // Employee Departments
  async getEmployeeDepartments(userId: string): Promise<EmployeeDepartment[]> {
    return db.select().from(employeeDepartments).where(eq(employeeDepartments.userId, userId));
  }

  async getDepartmentEmployeesWithDetails(departmentId: string): Promise<any[]> {
    const results = await db
      .select({
        id: employeeDepartments.id,
        userId: employeeDepartments.userId,
        departmentId: employeeDepartments.departmentId,
        createdAt: employeeDepartments.createdAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userProfileImageUrl: users.profileImageUrl,
      })
      .from(employeeDepartments)
      .leftJoin(users, eq(employeeDepartments.userId, users.id))
      .where(eq(employeeDepartments.departmentId, departmentId));
    
    return results.map(r => ({
      id: r.id,
      userId: r.userId,
      departmentId: r.departmentId,
      createdAt: r.createdAt,
      user: {
        id: r.userId,
        email: r.userEmail,
        firstName: r.userFirstName,
        lastName: r.userLastName,
        profileImageUrl: r.userProfileImageUrl,
      }
    }));
  }

  async getDepartmentEmployeeWithDetails(userId: string, departmentId: string): Promise<any | null> {
    const results = await db
      .select({
        id: employeeDepartments.id,
        userId: employeeDepartments.userId,
        departmentId: employeeDepartments.departmentId,
        createdAt: employeeDepartments.createdAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userProfileImageUrl: users.profileImageUrl,
      })
      .from(employeeDepartments)
      .leftJoin(users, eq(employeeDepartments.userId, users.id))
      .where(and(
        eq(employeeDepartments.userId, userId),
        eq(employeeDepartments.departmentId, departmentId)
      ));
    
    if (results.length === 0) return null;
    const r = results[0];
    return {
      id: r.id,
      userId: r.userId,
      departmentId: r.departmentId,
      createdAt: r.createdAt,
      user: {
        id: r.userId,
        email: r.userEmail,
        firstName: r.userFirstName,
        lastName: r.userLastName,
        profileImageUrl: r.userProfileImageUrl,
      }
    };
  }

  async addEmployeeToDepartment(data: InsertEmployeeDepartment): Promise<EmployeeDepartment> {
    const [result] = await db.insert(employeeDepartments).values(data).returning();
    return result;
  }

  async removeEmployeeFromDepartment(userId: string, departmentId: string): Promise<boolean> {
    await db.delete(employeeDepartments).where(
      and(eq(employeeDepartments.userId, userId), eq(employeeDepartments.departmentId, departmentId))
    );
    return true;
  }

  // Department Approvers
  async getDepartmentApproversWithDetails(departmentId: string): Promise<any[]> {
    const results = await db
      .select({
        id: departmentApprovers.id,
        userId: departmentApprovers.userId,
        departmentId: departmentApprovers.departmentId,
        createdAt: departmentApprovers.createdAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userProfileImageUrl: users.profileImageUrl,
      })
      .from(departmentApprovers)
      .leftJoin(users, eq(departmentApprovers.userId, users.id))
      .where(eq(departmentApprovers.departmentId, departmentId));
    
    return results.map(r => ({
      id: r.id,
      userId: r.userId,
      departmentId: r.departmentId,
      createdAt: r.createdAt,
      user: {
        id: r.userId,
        email: r.userEmail,
        firstName: r.userFirstName,
        lastName: r.userLastName,
        profileImageUrl: r.userProfileImageUrl,
      }
    }));
  }

  async getDepartmentApproverWithDetails(userId: string, departmentId: string): Promise<any | null> {
    const results = await db
      .select({
        id: departmentApprovers.id,
        userId: departmentApprovers.userId,
        departmentId: departmentApprovers.departmentId,
        createdAt: departmentApprovers.createdAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userProfileImageUrl: users.profileImageUrl,
      })
      .from(departmentApprovers)
      .leftJoin(users, eq(departmentApprovers.userId, users.id))
      .where(and(
        eq(departmentApprovers.userId, userId),
        eq(departmentApprovers.departmentId, departmentId)
      ));
    
    if (results.length === 0) return null;
    const r = results[0];
    return {
      id: r.id,
      userId: r.userId,
      departmentId: r.departmentId,
      createdAt: r.createdAt,
      user: {
        id: r.userId,
        email: r.userEmail,
        firstName: r.userFirstName,
        lastName: r.userLastName,
        profileImageUrl: r.userProfileImageUrl,
      }
    };
  }

  async isUserApproverForDepartment(userId: string, departmentId: string): Promise<boolean> {
    const [result] = await db.select().from(departmentApprovers).where(
      and(eq(departmentApprovers.userId, userId), eq(departmentApprovers.departmentId, departmentId))
    );
    return !!result;
  }

  async addDepartmentApprover(data: InsertDepartmentApprover): Promise<DepartmentApprover> {
    const [result] = await db.insert(departmentApprovers).values(data).returning();
    return result;
  }

  async removeDepartmentApprover(userId: string, departmentId: string): Promise<boolean> {
    await db.delete(departmentApprovers).where(
      and(eq(departmentApprovers.userId, userId), eq(departmentApprovers.departmentId, departmentId))
    );
    return true;
  }

  // Hours Submissions
  async createSubmission(data: InsertHoursSubmission): Promise<HoursSubmission> {
    const [submission] = await db.insert(hoursSubmissions).values(data).returning();
    return submission;
  }

  async getSubmission(id: string): Promise<HoursSubmission | undefined> {
    const [submission] = await db.select().from(hoursSubmissions).where(eq(hoursSubmissions.id, id));
    return submission;
  }

  async getSubmissionsByUser(userId: string): Promise<HoursSubmission[]> {
    return db.select().from(hoursSubmissions)
      .where(eq(hoursSubmissions.userId, userId))
      .orderBy(desc(hoursSubmissions.createdAt));
  }

  async getSubmissionsWithDetails(userId?: string): Promise<any[]> {
    const query = userId
      ? db.select().from(hoursSubmissions).where(eq(hoursSubmissions.userId, userId))
      : db.select().from(hoursSubmissions);
    
    const submissions = await query.orderBy(desc(hoursSubmissions.createdAt));
    
    return Promise.all(submissions.map(async (submission) => {
      const [dept] = await db.select().from(departments).where(eq(departments.id, submission.departmentId));
      const [user] = await db.select().from(users).where(eq(users.id, submission.userId));
      return { ...submission, department: dept, user };
    }));
  }

  async getPendingApprovals(approverId: string): Promise<any[]> {
    // Get departments where user is an approver
    const approverDepts = await db.select().from(departmentApprovers)
      .where(eq(departmentApprovers.userId, approverId));
    
    const deptIds = approverDepts.map(d => d.departmentId);
    
    if (deptIds.length === 0) return [];
    
    // Get pending submissions for those departments
    const pendingSubmissions = await db.select().from(hoursSubmissions)
      .where(eq(hoursSubmissions.status, "pending"))
      .orderBy(desc(hoursSubmissions.createdAt));
    
    const filtered = pendingSubmissions.filter(s => 
      deptIds.includes(s.departmentId) && s.userId !== approverId // Self-approval restriction
    );
    
    return Promise.all(filtered.map(async (submission) => {
      const [dept] = await db.select().from(departments).where(eq(departments.id, submission.departmentId));
      const [user] = await db.select().from(users).where(eq(users.id, submission.userId));
      return { ...submission, department: dept, user };
    }));
  }

  async getAllPendingApprovals(): Promise<any[]> {
    const pendingSubmissions = await db.select().from(hoursSubmissions)
      .where(eq(hoursSubmissions.status, "pending"))
      .orderBy(desc(hoursSubmissions.createdAt));
    
    return Promise.all(pendingSubmissions.map(async (submission) => {
      const [dept] = await db.select().from(departments).where(eq(departments.id, submission.departmentId));
      const [user] = await db.select().from(users).where(eq(users.id, submission.userId));
      return { ...submission, department: dept, user };
    }));
  }

  async approveSubmission(id: string, approverId: string, status: "approved" | "rejected", comment?: string): Promise<HoursSubmission | undefined> {
    const [updated] = await db.update(hoursSubmissions)
      .set({
        status,
        approvedBy: approverId,
        approvedAt: new Date(),
        approverComment: comment || null,
        updatedAt: new Date(),
      })
      .where(eq(hoursSubmissions.id, id))
      .returning();
    return updated;
  }

  async getRecentSubmissions(limit = 10): Promise<any[]> {
    const submissions = await db.select().from(hoursSubmissions)
      .orderBy(desc(hoursSubmissions.createdAt))
      .limit(limit);
    
    return Promise.all(submissions.map(async (submission) => {
      const [dept] = await db.select().from(departments).where(eq(departments.id, submission.departmentId));
      const [user] = await db.select().from(users).where(eq(users.id, submission.userId));
      return { ...submission, department: dept, user };
    }));
  }

  // Stats
  async getDashboardStats(userId: string): Promise<{ totalHoursSubmitted: number; pendingCount: number; approvedThisMonth: number }> {
    const allSubmissions = await db.select().from(hoursSubmissions)
      .where(eq(hoursSubmissions.userId, userId));
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const totalHoursSubmitted = allSubmissions
      .filter(s => s.status === "approved")
      .reduce((sum, s) => sum + s.totalHours, 0);
    
    const pendingCount = allSubmissions.filter(s => s.status === "pending").length;
    
    const approvedThisMonth = allSubmissions
      .filter(s => s.status === "approved" && s.approvedAt && new Date(s.approvedAt) >= startOfMonth)
      .reduce((sum, s) => sum + s.totalHours, 0);
    
    return { totalHoursSubmitted, pendingCount, approvedThisMonth };
  }

  async getAdminStats(): Promise<{ totalEmployees: number; totalDepartments: number; pendingApprovals: number; hoursThisMonth: number }> {
    const allUsers = await db.select().from(users);
    const allDepts = await db.select().from(departments);
    const pending = await db.select().from(hoursSubmissions).where(eq(hoursSubmissions.status, "pending"));
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const approvedThisMonth = await db.select().from(hoursSubmissions)
      .where(and(
        eq(hoursSubmissions.status, "approved"),
        gte(hoursSubmissions.approvedAt, startOfMonth)
      ));
    
    const hoursThisMonth = approvedThisMonth.reduce((sum, s) => sum + s.totalHours, 0);
    
    return {
      totalEmployees: allUsers.length,
      totalDepartments: allDepts.length,
      pendingApprovals: pending.length,
      hoursThisMonth,
    };
  }

  // Audit Logs
  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(data).returning();
    return log;
  }

  async getAuditLogs(limit = 100): Promise<any[]> {
    const logs = await db.select().from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
    
    return Promise.all(logs.map(async (log) => {
      const [user] = await db.select().from(users).where(eq(users.id, log.userId));
      return { ...log, user };
    }));
  }

  // Users
  async getAllUsersWithRoles(): Promise<any[]> {
    const allUsers = await db.select().from(users);
    
    return Promise.all(allUsers.map(async (user) => {
      const roles = await this.getUserRoles(user.id);
      const empDepts = await this.getEmployeeDepartments(user.id);
      const depts = await Promise.all(empDepts.map(async (ed) => {
        const [dept] = await db.select().from(departments).where(eq(departments.id, ed.departmentId));
        return dept;
      }));
      return { ...user, roles, departments: depts.filter(Boolean) };
    }));
  }
}

export const storage = new DatabaseStorage();
