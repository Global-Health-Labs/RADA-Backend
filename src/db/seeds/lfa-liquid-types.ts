import { eq } from "drizzle-orm";
import { db } from "../index";
import { lfaLiquidTypes, roles, users } from "../schema";

// Default LFA liquid types
const DEFAULT_LFA_LIQUID_TYPES = [
  {
    value: "water",
    displayName: "Water",
  },
  {
    value: "pbst",
    displayName: "PBST",
  },
  {
    value: "imaging",
    displayName: "Imaging",
  },
];

export async function seedLFALiquidTypes() {
  console.log("Seeding LFS liquid types...");

  try {
    // Get admin role first
    const adminRole = await db
      .select()
      .from(roles)
      .where(eq(roles.name, "admin"))
      .limit(1);

    if (!adminRole.length) {
      console.error("No admin role found. Please seed roles first.");
      return;
    }

    // Get admin user
    const adminUser = await db
      .select()
      .from(users)
      .where(eq(users.roleId, adminRole[0].id))
      .limit(1);

    if (!adminUser.length) {
      console.error("No admin user found. Please seed users first.");
      return;
    }

    // Insert LFS liquid types
    for (const type of DEFAULT_LFA_LIQUID_TYPES) {
      await db
        .insert(lfaLiquidTypes)
        .values({
          value: type.value,
          displayName: type.displayName,
          lastUpdatedBy: adminUser[0].id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing({ target: lfaLiquidTypes.value });
    }

    console.log("LFS liquid types seeded successfully");
  } catch (error) {
    console.error("Error seeding LFS liquid types:", error);
    throw error;
  }
}
