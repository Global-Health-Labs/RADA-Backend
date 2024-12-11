import { db } from "./index";
import { roles, users, experimentalPlans } from "./schema";
import { hashPassword } from "../utils/auth";
import { v4 as uuidv4 } from "uuid";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { seedLiquidTypes } from "./seeds/liquid-types";
import { seedVolumeUnits } from "./seeds/volume-units";

async function seed() {
  try {
    console.log("Seeding database...");

    // Create roles if they don't exist
    const roleIds = {
      admin: uuidv4(),
      user: uuidv4(),
      supervisor: uuidv4(),
    };

    const existingRoles = await db.select().from(roles);
    if (existingRoles.length === 0) {
      await db.insert(roles).values([
        { id: roleIds.admin, name: "admin" },
        { id: roleIds.user, name: "user" },
        { id: roleIds.supervisor, name: "supervisor" },
      ]);
      console.log("Roles created successfully");
    } else {
      console.log("Roles already exist");
      // Use existing role IDs
      const adminRole = existingRoles.find((role) => role.name === "admin");
      const userRole = existingRoles.find((role) => role.name === "user");
      const supervisorRole = existingRoles.find(
        (role) => role.name === "supervisor"
      );

      if (adminRole) roleIds.admin = adminRole.id;
      if (userRole) roleIds.user = userRole.id;
      if (supervisorRole) roleIds.supervisor = supervisorRole.id;
    }

    // Create admin user only if email doesn't exist
    const adminEmail = "admin@example.com";
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail));

    if (existingAdmin.length === 0) {
      const adminPassword = "Admin@123"; // You should change this in production
      const hashedPassword = await hashPassword(adminPassword);

      const adminUser = {
        id: uuidv4(),
        fullname: "Admin User",
        email: adminEmail,
        password: hashedPassword,
        roleId: roleIds.admin,
        confirmed: true,
      };

      await db.insert(users).values(adminUser);
      console.log("Admin user created successfully");
    } else {
      console.log("Admin user already exists");
    }

    // Seed Experimental Plans
    const pcrPlateSizes = [96, 384];

    // Check if experimental plans already exist
    const existingExperimentalPlans = await db.select().from(experimentalPlans);

    if (existingExperimentalPlans.length === 0) {
      const adminUser = await db
        .select()
        .from(users)
        .where(eq(users.email, adminEmail))
        .limit(1);

      if (adminUser.length === 0) {
        throw new Error(
          "Admin user not found. Cannot seed experimental plans."
        );
      }

      const experimentalPlanSeed = Array.from({ length: 20 }).map(
        (_, index) => ({
          id: uuidv4(),
          nameOfExperimentalPlan: faker.lorem.words({ min: 2, max: 4 }),
          numOfSampleConcentrations: faker.number.int({ min: 1, max: 10 }),
          numOfTechnicalReplicates: faker.number.int({ min: 1, max: 5 }),
          mastermixVolumePerReaction: faker.number.int({ min: 10, max: 50 }),
          sampleVolumePerReaction: faker.number.int({ min: 5, max: 25 }),
          pcrPlateSize: pcrPlateSizes[index % pcrPlateSizes.length],
          ownerId: adminUser[0].id,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      await db.insert(experimentalPlans).values(experimentalPlanSeed);
      console.log("Experimental Plans created successfully");
    } else {
      console.log("Experimental Plans already exist");
    }

    // Seed liquid types
    await seedLiquidTypes();

    // Seed volume units
    await seedVolumeUnits();

    console.log("\nYou can now login with:");
    console.log("Email: admin@example.com");
    console.log("Password: Admin@123");
    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    process.exit(0);
  }
}

seed();
