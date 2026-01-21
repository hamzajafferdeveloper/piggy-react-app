import { storage } from "./storage.js";
import { departments } from "@shared/schema";

async function checkDepartments() {
  console.log("🔍 Checking user departments...");

  const allUsers = await storage.getAllUsers();
  const allDepartments = await storage.getDepartments();

  console.log(`📊 Found ${allUsers.length} users and ${allDepartments.length} departments.`);

  if (allDepartments.length === 0) {
    console.log("⚠️ No departments found! Creating 'Engineering'...");
    const dept = await storage.createDepartment({
      name: "Engineering",
      description: "Default department"
    });
    console.log(`✅ Created department: ${dept.name} (${dept.id})`);
    allDepartments.push(dept);
  }

  for (const user of allUsers) {
    const userDepts = await storage.getEmployeeDepartments(user.id);
    console.log(`\n👤 User: ${user.firstName} ${user.lastName} (${user.email})`);
    
    if (userDepts.length === 0) {
        console.log("   ❌ No department assigned!");
        
        // Auto-fix for dev/testing: assign to first department
        const targetDept = allDepartments[0];
        console.log(`   🔧 Assigning to ${targetDept.name}...`);
        
        await storage.addEmployeeToDepartment({
            userId: user.id,
            departmentId: targetDept.id
        });
        console.log("   ✅ Assigned!");
    } else {
        const deptNames = userDepts.map(ud => {
            const d = allDepartments.find(d => d.id === ud.departmentId);
            return d ? d.name : "Unknown";
        });
        console.log(`   ✅ Departments: ${deptNames.join(", ")}`);
    }
  }
}

checkDepartments().catch(console.error);
