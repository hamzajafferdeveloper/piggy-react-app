import { storage } from "./storage.js";

async function checkAndFixAdminRole(email: string) {
  console.log("🔍 Checking admin role for:", email);
  
  const user = await storage.getUserByEmail(email);
  if (!user) {
    console.log("❌ User not found with email:", email);
    console.log("💡 Available users:");
    const allUsers = await storage.getAllUsers();
    allUsers.forEach(u => console.log(`   - ${u.email} (ID: ${u.id})`));
    return;
  }
  
  console.log("✅ User found:");
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.firstName} ${user.lastName}`);
  
  const roles = await storage.getUserRoles(user.id);
  console.log("\n📋 Current roles:", roles.map(r => r.role).join(", ") || "none");
  
  const hasAdmin = roles.some(r => r.role === "admin");
  if (!hasAdmin) {
    console.log("\n⚠️  Admin role is MISSING!");
    console.log("🔧 Adding admin role now...");
    
    await storage.addUserRole({
      userId: user.id,
      role: "admin"
    });
    
    console.log("✅ Admin role successfully added!");
    
    // Verify
    const updatedRoles = await storage.getUserRoles(user.id);
    console.log("📋 Updated roles:", updatedRoles.map(r => r.role).join(", "));
  } else {
    console.log("\n✅ Admin role is already assigned!");
  }
  
  console.log("\n🎯 User can now:");
  console.log("   - Override approvals");
  console.log("   - Edit any submission");
  console.log("   - Cancel any submission");
  console.log("   - Uncancel submissions");
  console.log("   - Assign/remove approvers");
}

// Get email from command line argument or use default
const email = process.argv[2] || "admin@test.com";
checkAndFixAdminRole(email).catch(console.error);
