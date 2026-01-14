import { db } from "../server/db";
import { hoursSubmissions, users, departments, userRoles } from "../shared/schema";
import { storage } from "../server/storage";
import { eq, or } from "drizzle-orm";
import { randomUUID } from "crypto";

async function testAutoEscalation() {
  console.log("🚀 Testing Auto-Escalation...");

  // 1. Create a test user
  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    email: `test-${Date.now()}@example.com`,
    password: "password",
    firstName: "Test",
    lastName: "User",
  });
  console.log(`Created test user: ${userId}`);

  // 2. Create a test department
  const deptId = randomUUID();
  await db.insert(departments).values({
    id: deptId,
    name: `Test Dept ${Date.now()}`,
  });
  console.log(`Created test department: ${deptId}`);

  // 3. Create a pending submission
  const subId = randomUUID();
  await db.insert(hoursSubmissions).values({
    id: subId,
    userId: userId,
    departmentId: deptId,
    date: new Date(),
    totalHours: 8,
    status: "pending",
  });
  console.log(`Created pending submission: ${subId}`);

  // 4. Manually backdate the createdAt timestamp to > 48h ago
  const oldDate = new Date();
  oldDate.setHours(oldDate.getHours() - 50);

  await db.update(hoursSubmissions)
    .set({ createdAt: oldDate })
    .where(eq(hoursSubmissions.id, subId));
  
  console.log(`Backdated submission ${subId} to ${oldDate.toISOString()}`);

  // 5. Trigger auto-escalation
  console.log("Triggering auto-escalation...");
  const count = await storage.autoEscalateSubmissions();
  console.log(`Auto-escalated ${count} submissions.`);

  // 6. Verify
  const updated = await storage.getSubmission(subId);
  if (updated?.status === "escalated") {
    console.log("✅ SUCCESS: Submission correctly escalated!");
    console.log(`Reason: ${updated.escalationReason}`);
  } else {
    console.log("❌ FAILURE: Submission status is still:", updated?.status);
  }

  // Cleanup
  await db.delete(hoursSubmissions).where(eq(hoursSubmissions.id, subId));
  await db.delete(departments).where(eq(departments.id, deptId));
  await db.delete(users).where(eq(users.id, userId));
  console.log("Cleaned up test data.");

  process.exit(0);
}

testAutoEscalation().catch(err => {
  console.error(err);
  process.exit(1);
});
