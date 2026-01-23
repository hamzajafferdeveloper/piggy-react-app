import {
  departments,
  userRoles,
  employeeDepartments,
  departmentApprovers,
  hoursSubmissions,
  auditLogs,
  submissionApprovers, // NEW
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
  type SubmissionApprover, // NEW
  type InsertSubmissionApprover, // NEW
  hoursWithdrawals, // NEW
  type HoursWithdrawal,
  type InsertHoursWithdrawal,
  users,
  type User,
  type UserWithRoles,
  type UpsertUser as InsertUser,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Departments
  getDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department | undefined>;
  createDepartment(data: InsertDepartment): Promise<Department>;
  updateDepartment(
    id: string,
    data: Partial<InsertDepartment>,
  ): Promise<Department | undefined>;
  deleteDepartment(id: string): Promise<boolean>;
  getDepartmentsWithStats(): Promise<
    (Department & { employeeCount: number; approverCount: number })[]
  >;

  // User Roles
  getUserRoles(userId: string): Promise<UserRole[]>;
  setUserRoles(userId: string, roles: string[]): Promise<UserRole[]>;
  addUserRole(data: InsertUserRole): Promise<UserRole>;
  removeUserRole(userId: string, role: string): Promise<boolean>;

  // Employee Departments
  getEmployeeDepartments(userId: string): Promise<EmployeeDepartment[]>;
  getDepartmentEmployeesWithDetails(departmentId: string): Promise<any[]>;
  getDepartmentEmployeeWithDetails(
    userId: string,
    departmentId: string,
  ): Promise<any | null>;
  addEmployeeToDepartment(
    data: InsertEmployeeDepartment,
  ): Promise<EmployeeDepartment>;
  removeEmployeeFromDepartment(
    userId: string,
    departmentId: string,
  ): Promise<boolean>;

  // Department Approvers
  getDepartmentApproversWithDetails(departmentId: string): Promise<any[]>;
  getDepartmentApproverWithDetails(
    userId: string,
    departmentId: string,
  ): Promise<any | null>;
  isUserApproverForDepartment(
    userId: string,
    departmentId: string,
  ): Promise<boolean>;
  addDepartmentApprover(
    data: InsertDepartmentApprover,
  ): Promise<DepartmentApprover>;
  removeDepartmentApprover(
    userId: string,
    departmentId: string,
  ): Promise<boolean>;

  // Hours Submissions
  createSubmission(data: InsertHoursSubmission): Promise<HoursSubmission>;
  getSubmission(id: string): Promise<HoursSubmission | undefined>;
  getSubmissionsByUser(userId: string): Promise<HoursSubmission[]>;
  getSubmissionsWithDetails(userId?: string): Promise<any[]>;
  getPendingApprovals(approverId: string): Promise<any[]>;
  getAllPendingApprovals(): Promise<any[]>;
  getEscalatedApprovals(): Promise<any[]>;
  approveSubmission(
    id: string,
    approverId: string,
    status: "approved" | "rejected",
    comment?: string,
  ): Promise<HoursSubmission | undefined>;
  escalateSubmission(
    id: string,
    reason: string,
  ): Promise<HoursSubmission | undefined>;
  autoEscalateSubmissions(): Promise<number>;
  getRecentSubmissions(limit?: number): Promise<any[]>;

  // NEW: Submission Approvers
  assignApprover(data: InsertSubmissionApprover): Promise<SubmissionApprover>;
  getSubmissionApprovers(submissionId: string): Promise<any[]>;
  removeSubmissionApprover(
    submissionId: string,
    approverUserId: string,
  ): Promise<boolean>;
  isUserAssignedApprover(
    submissionId: string,
    userId: string,
  ): Promise<boolean>;

  // NEW: Admin Override
  overrideSubmission(
    id: string,
    adminId: string,
    status: "approved" | "rejected",
    reason: string,
  ): Promise<HoursSubmission | undefined>;

  // NEW: Edit Submission
  updateSubmission(
    id: string,
    data: Partial<InsertHoursSubmission>,
    editorId: string,
  ): Promise<HoursSubmission | undefined>;

  // NEW: Cancel Submission
  cancelSubmission(
    id: string,
    userId: string,
    reason: string,
  ): Promise<HoursSubmission | undefined>;
  uncancelSubmission(
    id: string,
    adminId: string,
  ): Promise<HoursSubmission | undefined>;

  // Stats
  getDashboardStats(userId: string): Promise<{
    totalHoursSubmitted: number;
    pendingCount: number;
    approvedThisMonth: number;
  }>;
  getAdminStats(): Promise<{
    totalEmployees: number;
    totalDepartments: number;
    pendingApprovals: number;
    hoursThisMonth: number;
  }>;

  // Audit Logs
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(limit?: number): Promise<any[]>;

  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserWithRoles(id: string): Promise<UserWithRoles | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getAllUsersWithRoles(): Promise<any[]>;

  // NEW: Withdrawals
  createWithdrawal(data: InsertHoursWithdrawal): Promise<HoursWithdrawal>;
  getWithdrawalsByUser(userId: string): Promise<HoursWithdrawal[]>;
  getUserBalance(userId: string): Promise<{
    totalDeposited: number;
    totalWithdrawn: number;
    currentBalance: number;
  }>;

  approveWithdrawal(
    id: string,
    approverId: string,
  ): Promise<HoursWithdrawal | undefined>;
  rejectWithdrawal(
    id: string,
    approverId: string,
    reason: string,
  ): Promise<HoursWithdrawal | undefined>;

  getPendingWithdrawalApprovals(approverId: string): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // Departments
  async getDepartments(): Promise<Department[]> {
    return db.select().from(departments).orderBy(departments.name);
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    const [dept] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, id));
    return dept;
  }

  async createDepartment(data: InsertDepartment): Promise<Department> {
    const id = randomUUID();
    await db.insert(departments).values({ ...data, id });
    const [dept] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, id));
    return dept;
  }

  async updateDepartment(
    id: string,
    data: Partial<InsertDepartment>,
  ): Promise<Department | undefined> {
    await db.update(departments).set(data).where(eq(departments.id, id));
    const [dept] = await db
      .select()
      .from(departments)
      .where(eq(departments.id, id));
    return dept;
  }

  async deleteDepartment(id: string): Promise<boolean> {
    const result = await db.delete(departments).where(eq(departments.id, id));
    return true;
  }

  async getDepartmentsWithStats(): Promise<
    (Department & { employeeCount: number; approverCount: number })[]
  > {
    const depts = await this.getDepartments();
    const result = await Promise.all(
      depts.map(async (dept) => {
        const employees = await db
          .select()
          .from(employeeDepartments)
          .where(eq(employeeDepartments.departmentId, dept.id));
        const approvers = await db
          .select()
          .from(departmentApprovers)
          .where(eq(departmentApprovers.departmentId, dept.id));
        return {
          ...dept,
          employeeCount: employees.length,
          approverCount: approvers.length,
        };
      }),
    );
    return result;
  }

  // NEW: Withdrawals and Balance Logic
  async createWithdrawal(
    data: InsertHoursWithdrawal,
  ): Promise<HoursWithdrawal> {
    const id = randomUUID();
    await db.insert(hoursWithdrawals).values({ ...data, id });
    const [withdrawal] = await db
      .select()
      .from(hoursWithdrawals)
      .where(eq(hoursWithdrawals.id, id));
    return withdrawal;
  }

  async getWithdrawalsByUser(userId: string): Promise<HoursWithdrawal[]> {
    return db
      .select()
      .from(hoursWithdrawals)
      .where(eq(hoursWithdrawals.userId, userId))
      .orderBy(desc(hoursWithdrawals.date));
  }

  async approveWithdrawal(
    id: string,
    approverId: string,
  ): Promise<HoursWithdrawal | undefined> {
    const [withdrawal] = await db
      .update(hoursWithdrawals)
      .set({ status: "approved" })
      .where(eq(hoursWithdrawals.id, id));

    const [updated] = await db
      .select()
      .from(hoursWithdrawals)
      .where(eq(hoursWithdrawals.id, id));
    return updated;
  }

  async rejectWithdrawal(
    id: string,
    approverId: string,
    reason: string,
  ): Promise<HoursWithdrawal | undefined> {
    await db
      .update(hoursWithdrawals)
      .set({ status: "rejected", reason: reason }) // Store rejection reason in reason field
      .where(eq(hoursWithdrawals.id, id));

    const [updated] = await db
      .select()
      .from(hoursWithdrawals)
      .where(eq(hoursWithdrawals.id, id));
    return updated;
  }

  async getUserBalance(userId: string): Promise<{
    totalDeposited: number;
    totalWithdrawn: number;
    currentBalance: number;
  }> {
    // 1. Calculate Total Deposited (Approved hours ONLY)
    // We only count submissions with status 'approved'
    // 'escalated' or 'pending' do NOT count towards balance yet.
    const approvedSubmissions = await db
      .select({
        totalHours: hoursSubmissions.totalHours,
      })
      .from(hoursSubmissions)
      .where(
        and(
          eq(hoursSubmissions.userId, userId),
          eq(hoursSubmissions.status, "approved"),
        ),
      );

    const totalDeposited = approvedSubmissions.reduce(
      (sum, sub) => sum + sub.totalHours,
      0,
    );

    // 2. Calculate Total Withdrawn
    const withdrawals = await db
      .select({
        amount: hoursWithdrawals.amount,
      })
      .from(hoursWithdrawals)
      .where(
        and(
          eq(hoursWithdrawals.userId, userId),
          eq(hoursWithdrawals.status, "approved"),
        ),
      );

    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    // 3. Calculate Balance
    const currentBalance = totalDeposited - totalWithdrawn;

    return {
      totalDeposited,
      totalWithdrawn,
      currentBalance,
    };
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
        roles.map((role) => ({
          id: randomUUID(),
          userId,
          role: role as "employee" | "approver" | "admin",
        })),
      );
    }

    return this.getUserRoles(userId);
  }

  async addUserRole(data: InsertUserRole): Promise<UserRole> {
    const id = randomUUID();
    await db.insert(userRoles).values({ ...data, id });
    const [role] = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.id, id));
    return role;
  }

  async removeUserRole(userId: string, role: string): Promise<boolean> {
    await db
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.role, role as "employee" | "approver" | "admin"),
        ),
      );
    return true;
  }

  // Employee Departments
  async getEmployeeDepartments(userId: string): Promise<EmployeeDepartment[]> {
    return db
      .select()
      .from(employeeDepartments)
      .where(eq(employeeDepartments.userId, userId));
  }

  async getDepartmentEmployeesWithDetails(
    departmentId: string,
  ): Promise<any[]> {
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

    return results.map((r) => ({
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
      },
    }));
  }

  async getDepartmentEmployeeWithDetails(
    userId: string,
    departmentId: string,
  ): Promise<any | null> {
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
      .where(
        and(
          eq(employeeDepartments.userId, userId),
          eq(employeeDepartments.departmentId, departmentId),
        ),
      );

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
      },
    };
  }

  async addEmployeeToDepartment(
    data: InsertEmployeeDepartment,
  ): Promise<EmployeeDepartment> {
    const id = randomUUID();
    await db.insert(employeeDepartments).values({ ...data, id });
    const [result] = await db
      .select()
      .from(employeeDepartments)
      .where(eq(employeeDepartments.id, id));
    return result;
  }

  async removeEmployeeFromDepartment(
    userId: string,
    departmentId: string,
  ): Promise<boolean> {
    await db
      .delete(employeeDepartments)
      .where(
        and(
          eq(employeeDepartments.userId, userId),
          eq(employeeDepartments.departmentId, departmentId),
        ),
      );
    return true;
  }

  // Department Approvers
  async getDepartmentApproversWithDetails(
    departmentId: string,
  ): Promise<any[]> {
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

    return results.map((r) => ({
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
      },
    }));
  }

  async getDepartmentApproverWithDetails(
    userId: string,
    departmentId: string,
  ): Promise<any | null> {
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
      .where(
        and(
          eq(departmentApprovers.userId, userId),
          eq(departmentApprovers.departmentId, departmentId),
        ),
      );

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
      },
    };
  }

  async isUserApproverForDepartment(
    userId: string,
    departmentId: string,
  ): Promise<boolean> {
    const [result] = await db
      .select()
      .from(departmentApprovers)
      .where(
        and(
          eq(departmentApprovers.userId, userId),
          eq(departmentApprovers.departmentId, departmentId),
        ),
      );
    return !!result;
  }

  async addDepartmentApprover(
    data: InsertDepartmentApprover,
  ): Promise<DepartmentApprover> {
    const id = randomUUID();
    await db.insert(departmentApprovers).values({ ...data, id });
    const [result] = await db
      .select()
      .from(departmentApprovers)
      .where(eq(departmentApprovers.id, id));
    return result;
  }

  async removeDepartmentApprover(
    userId: string,
    departmentId: string,
  ): Promise<boolean> {
    await db
      .delete(departmentApprovers)
      .where(
        and(
          eq(departmentApprovers.userId, userId),
          eq(departmentApprovers.departmentId, departmentId),
        ),
      );
    return true;
  }

  // Hours Submissions
  async createSubmission(
    data: InsertHoursSubmission,
  ): Promise<HoursSubmission> {
    const id = randomUUID();
    await db.insert(hoursSubmissions).values({ ...data, id });
    const [submission] = await db
      .select()
      .from(hoursSubmissions)
      .where(eq(hoursSubmissions.id, id));
    return submission;
  }

  async getSubmission(id: string): Promise<HoursSubmission | undefined> {
    const [submission] = await db
      .select()
      .from(hoursSubmissions)
      .where(eq(hoursSubmissions.id, id));
    return submission;
  }

  async getSubmissionsByUser(userId: string): Promise<HoursSubmission[]> {
    return db
      .select()
      .from(hoursSubmissions)
      .where(eq(hoursSubmissions.userId, userId))
      .orderBy(desc(hoursSubmissions.createdAt));
  }

  async getSubmissionsWithDetails(userId?: string): Promise<any[]> {
    const query = userId
      ? db
          .select()
          .from(hoursSubmissions)
          .where(eq(hoursSubmissions.userId, userId))
      : db.select().from(hoursSubmissions);

    const submissions = await query.orderBy(desc(hoursSubmissions.createdAt));

    return Promise.all(
      submissions.map(async (submission) => {
        const [dept] = await db
          .select()
          .from(departments)
          .where(eq(departments.id, submission.departmentId));
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, submission.userId));
        return { ...submission, department: dept, user };
      }),
    );
  }

  async getAllSubmissionsWithDetails({
    page = 1,
    limit = 10,
    search = "",
  }: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<{ submissions: any[]; total: number }> {
    const offset = (page - 1) * limit;

    // Base query with joins
    let query = db
      .select({
        id: hoursSubmissions.id,
        date: hoursSubmissions.date,
        // hours: hoursSubmissions.hours,
        status: hoursSubmissions.status,
        // description: hoursSubmissions.description,
        createdAt: hoursSubmissions.createdAt,
        updatedAt: hoursSubmissions.updatedAt,
        department: {
          id: departments.id,
          name: departments.name,
        },
        user: {
          id: users.id,
          // name: users.name,
          email: users.email,
        },
      })
      .from(hoursSubmissions)
      .leftJoin(users, eq(hoursSubmissions.userId, users.id))
      .leftJoin(departments, eq(hoursSubmissions.departmentId, departments.id))
      .$dynamic();

    // Add search conditions if search term exists
    if (search) {
      const searchTerm = `%${search.toLowerCase()}%`;
      query = query.where(
        or(
          // sql`LOWER(${users.name}) LIKE ${searchTerm}`,
          sql`LOWER(${users.email}) LIKE ${searchTerm}`,
          sql`LOWER(${departments.name}) LIKE ${searchTerm}`,
          // sql`LOWER(${hoursSubmissions.description}) LIKE ${searchTerm}`,
        ),
      );
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(hoursSubmissions)
      .leftJoin(users, eq(hoursSubmissions.userId, users.id))
      .leftJoin(departments, eq(hoursSubmissions.departmentId, departments.id))
      .$dynamic();

    const total = countResult[0]?.count || 0;

    // Get paginated results
    const submissions = await query
      .orderBy(desc(hoursSubmissions.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      submissions,
      total,
    };
  }

  async getPendingApprovals(approverId: string): Promise<any[]> {
    // Get departments where user is an approver
    const approverDepts = await db
      .select()
      .from(departmentApprovers)
      .where(eq(departmentApprovers.userId, approverId));

    const deptIds = approverDepts.map((d) => d.departmentId);

    if (deptIds.length === 0) return [];

    // Get pending submissions for those departments
    const pendingSubmissions = await db
      .select()
      .from(hoursSubmissions)
      .where(eq(hoursSubmissions.status, "pending"))
      .orderBy(desc(hoursSubmissions.createdAt));

    const filtered = pendingSubmissions.filter(
      (s) =>
        deptIds.includes(s.departmentId) &&
        s.userId !== approverId &&
        s.status === "pending", // Only show non-escalated to regular approvers
    );

    return Promise.all(
      filtered.map(async (submission) => {
        const [dept] = await db
          .select()
          .from(departments)
          .where(eq(departments.id, submission.departmentId));
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, submission.userId));
        return { ...submission, department: dept, user };
      }),
    );
  }

  async getAllPendingApprovals(): Promise<any[]> {
    const pendingSubmissions = await db
      .select()
      .from(hoursSubmissions)
      .where(eq(hoursSubmissions.status, "pending"))
      .orderBy(desc(hoursSubmissions.createdAt));

    return Promise.all(
      pendingSubmissions.map(async (submission) => {
        const [dept] = await db
          .select()
          .from(departments)
          .where(eq(departments.id, submission.departmentId));
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, submission.userId));
        return { ...submission, department: dept, user };
      }),
    );
  }

  async getAllApprovals(): Promise<any[]> {
    const allSubmissions = await db
      .select()
      .from(hoursSubmissions)
      .orderBy(desc(hoursSubmissions.createdAt));

    console.log("ALL Submissions: ", allSubmissions);

    return Promise.all(
      allSubmissions.map(async (submission) => {
        const [dept] = await db
          .select()
          .from(departments)
          .where(eq(departments.id, submission.departmentId));
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, submission.userId));
        return { ...submission, department: dept, user };
      }),
    );
  }

  async getEscalatedApprovals(): Promise<any[]> {
    const escalatedSubmissions = await db
      .select()
      .from(hoursSubmissions)
      .where(eq(hoursSubmissions.status, "escalated"))
      .orderBy(desc(hoursSubmissions.escalatedAt));

    return Promise.all(
      escalatedSubmissions.map(async (submission) => {
        const [dept] = await db
          .select()
          .from(departments)
          .where(eq(departments.id, submission.departmentId));
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, submission.userId));
        return { ...submission, department: dept, user };
      }),
    );
  }

  async approveSubmission(
    id: string,
    approverId: string,
    status: "approved" | "rejected",
    comment?: string,
  ): Promise<HoursSubmission | undefined> {
    await db
      .update(hoursSubmissions)
      .set({
        status,
        approvedBy: approverId,
        approvedAt: new Date(),
        approverComment: comment || null,
        updatedAt: new Date(),
      })
      .where(eq(hoursSubmissions.id, id));

    const [updated] = await db
      .select()
      .from(hoursSubmissions)
      .where(eq(hoursSubmissions.id, id));
    return updated;
  }

  async escalateSubmission(
    id: string,
    reason: string,
  ): Promise<HoursSubmission | undefined> {
    await db
      .update(hoursSubmissions)
      .set({
        status: "escalated",
        escalatedAt: new Date(),
        escalationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(hoursSubmissions.id, id));

    const [updated] = await db
      .select()
      .from(hoursSubmissions)
      .where(eq(hoursSubmissions.id, id));
    return updated;
  }

  async autoEscalateSubmissions(): Promise<number> {
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

    const pendingToEscalate = await db
      .select()
      .from(hoursSubmissions)
      .where(
        and(
          eq(hoursSubmissions.status, "pending"),
          lte(hoursSubmissions.createdAt, fortyEightHoursAgo),
        ),
      );

    if (pendingToEscalate.length === 0) return 0;

    await Promise.all(
      pendingToEscalate.map(async (submission) => {
        await this.escalateSubmission(
          submission.id,
          "Automatic escalation after 48 hours",
        );
      }),
    );

    return pendingToEscalate.length;
  }

  async getRecentSubmissions(limit = 10): Promise<any[]> {
    const submissions = await db
      .select()
      .from(hoursSubmissions)
      .orderBy(desc(hoursSubmissions.createdAt))
      .limit(limit);

    return Promise.all(
      submissions.map(async (submission) => {
        const [dept] = await db
          .select()
          .from(departments)
          .where(eq(departments.id, submission.departmentId));
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, submission.userId));
        return { ...submission, department: dept, user };
      }),
    );
  }

  async assignApprover(
    data: InsertSubmissionApprover,
  ): Promise<SubmissionApprover> {
    const id = randomUUID();
    await db.insert(submissionApprovers).values({ ...data, id });
    const [approver] = await db
      .select()
      .from(submissionApprovers)
      .where(eq(submissionApprovers.id, id));
    return approver;
  }

  async getSubmissionApprovers(submissionId: string): Promise<any[]> {
    const approvers = await db
      .select()
      .from(submissionApprovers)
      .where(eq(submissionApprovers.submissionId, submissionId))
      .orderBy(submissionApprovers.approvalOrder);

    return Promise.all(
      approvers.map(async (approver) => {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, approver.approverUserId));
        const [assignedByUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, approver.assignedBy));
        return {
          ...approver,
          approver: user,
          assignedByUser,
        };
      }),
    );
  }

  async removeSubmissionApprover(
    submissionId: string,
    approverUserId: string,
  ): Promise<boolean> {
    await db
      .delete(submissionApprovers)
      .where(
        and(
          eq(submissionApprovers.submissionId, submissionId),
          eq(submissionApprovers.approverUserId, approverUserId),
        ),
      );
    return true;
  }

  async isUserAssignedApprover(
    submissionId: string,
    userId: string,
  ): Promise<boolean> {
    const [result] = await db
      .select()
      .from(submissionApprovers)
      .where(
        and(
          eq(submissionApprovers.submissionId, submissionId),
          eq(submissionApprovers.approverUserId, userId),
        ),
      );
    return !!result;
  }

  async overrideSubmission(
    id: string,
    adminId: string,
    status: "approved" | "rejected",
    reason: string,
  ): Promise<HoursSubmission | undefined> {
    // Validate reason length
    if (!reason || reason.trim().length < 10) {
      throw new Error("Override reason must be at least 10 characters");
    }

    await db
      .update(hoursSubmissions)
      .set({
        status,
        isOverridden: true,
        overriddenBy: adminId,
        overriddenAt: new Date(),
        overrideReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(hoursSubmissions.id, id));

    const [updated] = await db
      .select()
      .from(hoursSubmissions)
      .where(eq(hoursSubmissions.id, id));
    return updated;
  }

  async updateSubmission(
    id: string,
    data: Partial<InsertHoursSubmission>,
    editorId: string,
  ): Promise<HoursSubmission | undefined> {
    const [existing] = await db
      .select()
      .from(hoursSubmissions)
      .where(eq(hoursSubmissions.id, id));
    if (!existing) return undefined;

    // Increment edit count
    const newEditCount = (existing.editCount || 0) + 1;

    await db
      .update(hoursSubmissions)
      .set({
        ...data,
        editCount: newEditCount,
        lastEditedBy: editorId,
        lastEditedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(hoursSubmissions.id, id));

    const [updated] = await db
      .select()
      .from(hoursSubmissions)
      .where(eq(hoursSubmissions.id, id));
    return updated;
  }

  async cancelSubmission(
    id: string,
    userId: string,
    reason: string,
  ): Promise<HoursSubmission | undefined> {
    // Validate reason
    if (!reason || reason.trim().length < 5) {
      throw new Error("Cancellation reason is required (minimum 5 characters)");
    }

    await db
      .update(hoursSubmissions)
      .set({
        isCancelled: true,
        cancelledBy: userId,
        cancelledAt: new Date(),
        cancellationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(hoursSubmissions.id, id));

    const [updated] = await db
      .select()
      .from(hoursSubmissions)
      .where(eq(hoursSubmissions.id, id));
    return updated;
  }

  async uncancelSubmission(
    id: string,
    adminId: string,
  ): Promise<HoursSubmission | undefined> {
    await db
      .update(hoursSubmissions)
      .set({
        isCancelled: false,
        // Keep cancellation history for audit purposes
        updatedAt: new Date(),
      })
      .where(eq(hoursSubmissions.id, id));

    const [updated] = await db
      .select()
      .from(hoursSubmissions)
      .where(eq(hoursSubmissions.id, id));
    return updated;
  }

  // Stats
  async getDashboardStats(userId: string): Promise<{
    totalHoursSubmitted: number;
    pendingCount: number;
    approvedThisMonth: number;
  }> {
    const allSubmissions = await db
      .select()
      .from(hoursSubmissions)
      .where(eq(hoursSubmissions.userId, userId));

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalHoursSubmitted = allSubmissions
      .filter((s) => s.status === "approved")
      .reduce((sum, s) => sum + s.totalHours, 0);

    const pendingCount = allSubmissions.filter(
      (s) => s.status === "pending",
    ).length;

    const approvedThisMonth = allSubmissions
      .filter(
        (s) =>
          s.status === "approved" &&
          s.approvedAt &&
          new Date(s.approvedAt) >= startOfMonth,
      )
      .reduce((sum, s) => sum + s.totalHours, 0);

    return { totalHoursSubmitted, pendingCount, approvedThisMonth };
  }

  async getAdminStats(): Promise<{
    totalEmployees: number;
    totalDepartments: number;
    pendingApprovals: number;
    hoursThisMonth: number;
  }> {
    const allUsers = await db.select().from(users);
    const allDepts = await db.select().from(departments);
    const pending = await db
      .select()
      .from(hoursSubmissions)
      .where(
        or(
          eq(hoursSubmissions.status, "pending"),
          eq(hoursSubmissions.status, "escalated"),
        ),
      );

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const approvedThisMonth = await db
      .select()
      .from(hoursSubmissions)
      .where(
        and(
          eq(hoursSubmissions.status, "approved"),
          gte(hoursSubmissions.approvedAt, startOfMonth),
        ),
      );

    const hoursThisMonth = approvedThisMonth.reduce(
      (sum, s) => sum + s.totalHours,
      0,
    );

    return {
      totalEmployees: allUsers.length,
      totalDepartments: allDepts.length,
      pendingApprovals: pending.length,
      hoursThisMonth,
    };
  }

  // Audit Logs
  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    await db.insert(auditLogs).values({ ...data, id });
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.id, id));
    return log;
  }

  async getAuditLogs(limit = 100): Promise<any[]> {
    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    return Promise.all(
      logs.map(async (log) => {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, log.userId));
        return { ...log, user };
      }),
    );
  }

  // Users
  async getAllUsersWithRoles(): Promise<any[]> {
    const allUsers = await db.select().from(users);
    const usersWithRoles = await Promise.all(
      allUsers.map(async (user) => {
        const roles = await this.getUserRoles(user.id);
        return { ...user, roles };
      }),
    );
    return usersWithRoles;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserWithRoles(id: string): Promise<UserWithRoles | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;

    const userRoleRecords = await this.getUserRoles(id);
    const roles = userRoleRecords.map((r) => r.role);

    return { ...user, roles };
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(data: InsertUser): Promise<User> {
    const id = randomUUID();
    await db.insert(users).values({ ...data, id });
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }
}

export const storage = new DatabaseStorage();
