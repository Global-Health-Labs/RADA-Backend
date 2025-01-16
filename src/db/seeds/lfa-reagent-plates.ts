import { db } from "../index";
import { reagentPlates, users, roles } from "../schema";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";

// Default reagent plates from CSV
const DEFAULT_REAGENT_PLATES = [
  {
    plate: "ivl_1_flat_v1",
    volumeWell: 40000,
    numRows: 1,
    numCols: 1,
    volumeHoldover: 800,
  },
  {
    plate: "ivl_96_dw_v1",
    volumeWell: 1000,
    numRows: 8,
    numCols: 12,
    volumeHoldover: 60,
  },
  {
    plate: "ivl_384_flat_v1",
    volumeWell: 90,
    numRows: 16,
    numCols: 24,
    volumeHoldover: 40,
  },
];

export async function seedReagentPlates() {
  console.log("Seeding reagent plates...");

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

    // Insert reagent plates
    for (const plate of DEFAULT_REAGENT_PLATES) {
      await db
        .insert(reagentPlates)
        .values({
          plate: plate.plate,
          volumeWell: plate.volumeWell,
          numRows: plate.numRows,
          numCols: plate.numCols,
          volumeHoldover: plate.volumeHoldover,
          lastUpdatedBy: adminUser[0].id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing({ target: reagentPlates.plate });
    }

    console.log("Reagent plates seeded successfully");
  } catch (error) {
    console.error("Error seeding reagent plates:", error);
    throw error;
  }
}
