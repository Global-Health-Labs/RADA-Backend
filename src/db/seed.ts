import { db } from "./index";
import {
  roles,
  users,
  naatExperiments,
  naatPresets,
  masterMixes,
  masterMixRecipes,
} from "./schema";
import { hashPassword } from "../utils/auth";
import { v4 as uuidv4 } from "uuid";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { seedLiquidTypes as seedNAATLiquidTypes } from "./seeds/naat-liquid-types";
import { seedVolumeUnits as seedNAATVolumeUnits } from "./seeds/naat-volume-units";
import { seedReagentPlates } from "./seeds/lfa-reagent-plates";
import { seedLFALiquidTypes } from "./seeds/lfa-liquid-types";
import { NAAT_PRESETS } from "./seeds/naat-presets";

const addMockUsers = false;
const addMockExperiments = false;

interface RoleIds {
  admin: string;
  user: string;
  supervisor: string;
}

async function seedRoles(): Promise<RoleIds> {
  console.log("Seeding roles...");

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

  return roleIds;
}

async function seedUsers(roleIds: RoleIds) {
  console.log("Seeding users...");

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
}

async function seedExperiments() {
  console.log("Seeding experimental plans...");

  const pcrPlateSizes = [96, 384];

  // Check if experimental plans already exist
  const existingExperimentalPlans = await db.select().from(naatExperiments);

  if (existingExperimentalPlans.length === 0) {
    const adminUser = await db
      .select()
      .from(users)
      .where(eq(users.email, "admin@example.com"))
      .limit(1);

    if (adminUser.length === 0) {
      throw new Error("Admin user not found. Cannot seed experimental plans.");
    }

    const experimentalPlanSeed = Array.from({ length: 20 }).map((_, index) => ({
      id: uuidv4(),
      name: faker.lorem.words({ min: 2, max: 4 }),
      numOfSampleConcentrations: faker.number.int({ min: 1, max: 10 }),
      numOfTechnicalReplicates: faker.number.int({ min: 1, max: 5 }),
      mastermixVolumePerReaction: faker.number.int({ min: 10, max: 50 }),
      sampleVolumePerReaction: faker.number.int({ min: 5, max: 25 }),
      pcrPlateSize: pcrPlateSizes[index % pcrPlateSizes.length],
      ownerId: adminUser[0].id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await db.insert(naatExperiments).values(experimentalPlanSeed);
    console.log("Experimental plans seeded successfully");
  } else {
    console.log("Experimental plans already exist");
  }
}

async function seedNAATPresets() {
  console.log("Seeding NAAT presets...");

  // Get admin user for owner reference
  const adminUser = await db
    .select()
    .from(users)
    .where(eq(users.email, "admin@example.com"))
    .limit(1);

  if (adminUser.length === 0) {
    throw new Error("Admin user not found. Cannot seed NAAT presets.");
  }

  // Check if presets already exist
  const existingPresets = await db
    .select()
    .from(naatExperiments)
    .innerJoin(naatPresets, eq(naatExperiments.id, naatPresets.experimentId));

  if (existingPresets.length > 0) {
    console.log("NAAT presets already exist");
    return;
  }

  // Insert presets and their associated data
  for (const preset of NAAT_PRESETS) {
    // Create experiment
    const [experiment] = await db
      .insert(naatExperiments)
      .values({
        id: uuidv4(),
        name: preset.name,
        numOfSampleConcentrations: preset.numOfSampleConcentrations,
        numOfTechnicalReplicates: preset.numOfTechnicalReplicates,
        mastermixVolumePerReaction: preset.mastermixVolumePerReaction,
        sampleVolumePerReaction: preset.sampleVolumePerReaction,
        pcrPlateSize: preset.pcrPlateSize,
        ownerId: adminUser[0].id,
      })
      .returning();

    // Mark as preset
    await db.insert(naatPresets).values({
      experimentId: experiment.id,
      updatedBy: adminUser[0].id,
    });

    // Create mastermixes and their recipes
    for (const mastermix of preset.mastermixes) {
      const [newMastermix] = await db
        .insert(masterMixes)
        .values({
          nameOfMastermix: mastermix.nameOfMastermix,
          experimentalPlanId: experiment.id,
          orderIndex: mastermix.orderIndex,
        })
        .returning();

      // Create recipes for this mastermix
      await db.insert(masterMixRecipes).values(
        mastermix.recipes.map((recipe) => ({
          orderIndex: recipe.orderIndex,
          mastermixId: newMastermix.id,
          finalSource: recipe.finalSource,
          unit: recipe.unit,
          finalConcentration: recipe.finalConcentration,
          tipWashing: recipe.tipWashing,
          stockConcentration: recipe.stockConcentration,
          liquidType: recipe.liquidType,
          dispenseType: recipe.dispenseType,
        }))
      );
    }
  }

  console.log("NAAT presets seeded successfully");
}

async function seed() {
  try {
    console.log("Seeding database...");

    // Seed roles and get role IDs
    const roleIds = await seedRoles();

    // Seed users
    if (addMockUsers) {
      await seedUsers(roleIds);
    }

    // Seed experimental plans
    if (addMockExperiments) {
      await seedExperiments();
    }

    // Seed other data
    await seedNAATLiquidTypes();
    await seedNAATVolumeUnits();
    await seedReagentPlates();
    await seedLFALiquidTypes();
    await seedNAATPresets();

    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

seed();
