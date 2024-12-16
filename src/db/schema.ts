import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  integer,
  text,
  real,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullname: varchar("fullname", { length: 50 }).notNull(),
  email: varchar("email", { length: 50 }).notNull().unique(),
  password: varchar("password", { length: 256 }),
  roleId: uuid("role_id").references(() => roles.id),
  roleUpdatedAt: timestamp("role_updated_at").defaultNow(),
  confirmed: boolean("confirmed").default(false).notNull(),
  status: text("status", { enum: ["active", "disabled"] }).default("active").notNull(),
});

export const roles = pgTable("role", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
});

export const masterMixes = pgTable("master_mix", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameOfMastermix: varchar("name_of_mastermix", { length: 50 }).notNull(),
  experimentalPlanId: uuid("experimental_plan_id").references(
    () => experimentalPlans.id
  ),
  orderIndex: integer("order_index"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const masterMixRecipes = pgTable("master_mix_recipe", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderIndex: integer("order_index"),
  mastermixId: uuid("mastermix_id").references(() => masterMixes.id),
  finalSource: varchar("final_source", { length: 50 }),
  unit: varchar("unit", { length: 50 }),
  finalConcentration: real("final_concentration"),
  tipWashing: varchar("tip_washing", { length: 50 }),
  stockConcentration: real("stock_concentration"),
  liquidType: varchar("liquid_type", { length: 50 }),
  dispenseType: varchar("dispense_type", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const experimentalPlans = pgTable("experimental_plan", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameOfExperimentalPlan: varchar("name_of_experimental_plan", { length: 255 }),
  numOfSampleConcentrations: integer("num_of_sample_concentrations"),
  numOfTechnicalReplicates: integer("num_of_technical_replicates"),
  mastermixVolumePerReaction: integer("mastermix_volume_per_reaction"),
  sampleVolumePerReaction: integer("sample_volume_per_reaction"),
  pcrPlateSize: integer("pcr_plate_size"),
  deckLayoutId: uuid("deck_layout_id").references(() => deckLayouts.id),
  ownerId: uuid("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documents = pgTable("document", {
  id: uuid("id").defaultRandom().primaryKey(),
  experimentPlanId: uuid("experiment_plan_id").references(
    () => experimentalPlans.id
  ),
  originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
  secureFileName: varchar("secure_file_name", { length: 255 }).notNull(),
  s3Url: varchar("s3_url", { length: 255 }).notNull(),
  contentType: varchar("content_type", { length: 50 }),
  fileSize: integer("file_size"),
  fileHash: varchar("file_hash", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const liquidTypes = pgTable("liquid_type", {
  id: uuid("id").defaultRandom().primaryKey(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  value: varchar("value", { length: 100 }).notNull().unique(),
  needsTipWashing: boolean("needs_tip_washing").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastUpdatedBy: uuid("last_updated_by")
    .references(() => users.id)
    .notNull(),
});

export const volumeUnits = pgTable("volume_unit", {
  id: uuid("id").defaultRandom().primaryKey(),
  unit: varchar("unit", { length: 50 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastUpdatedBy: uuid("last_updated_by")
    .references(() => users.id)
    .notNull(),
});

export const deckLayouts = pgTable("deck_layout", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  platePositions: jsonb("plate_positions").notNull().$type<
    {
      id: string;
      name: string;
      position: number;
    }[]
  >(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
}));

export const masterMixesRelations = relations(masterMixes, ({ one, many }) => ({
  experimentalPlan: one(experimentalPlans, {
    fields: [masterMixes.experimentalPlanId],
    references: [experimentalPlans.id],
  }),
  recipes: many(masterMixRecipes),
}));

export const masterMixRecipesRelations = relations(
  masterMixRecipes,
  ({ one }) => ({
    masterMix: one(masterMixes, {
      fields: [masterMixRecipes.mastermixId],
      references: [masterMixes.id],
    }),
  })
);

export const experimentalPlansRelations = relations(
  experimentalPlans,
  ({ one, many }) => ({
    owner: one(users, {
      fields: [experimentalPlans.ownerId],
      references: [users.id],
    }),
    deckLayout: one(deckLayouts, {
      fields: [experimentalPlans.deckLayoutId],
      references: [deckLayouts.id],
    }),
    masterMixes: many(masterMixes),
    documents: many(documents),
  })
);

export const documentsRelations = relations(documents, ({ one }) => ({
  experimentalPlan: one(experimentalPlans, {
    fields: [documents.experimentPlanId],
    references: [experimentalPlans.id],
  }),
}));

export const deckLayoutsRelations = relations(deckLayouts, ({ one }) => ({
  creator: one(users, {
    fields: [deckLayouts.createdBy],
    references: [users.id],
  }),
}));
