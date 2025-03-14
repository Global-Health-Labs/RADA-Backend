import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullname: varchar("fullname", { length: 50 }).notNull(),
  email: varchar("email", { length: 50 }).notNull().unique(),
  password: varchar("password", { length: 256 }),
  roleId: uuid("role_id").references(() => roles.id),
  roleUpdatedAt: timestamp("role_updated_at").defaultNow(),
  confirmed: boolean("confirmed").default(false).notNull(),
  status: text("status", { enum: ["active", "disabled"] })
    .default("active")
    .notNull(),
});

export const roles = pgTable("role", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
});

export const masterMixes = pgTable("master_mix", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameOfMastermix: varchar("name_of_mastermix", { length: 50 }).notNull(),
  experimentalPlanId: uuid("experimental_plan_id").references(
    () => naatExperiments.id
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

export const naatExperiments = pgTable("experimental_plan", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name_of_experimental_plan", { length: 255 }),
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

export const experimentFiles = pgTable("experiment_file", {
  id: uuid("id").defaultRandom().primaryKey(),
  experimentId: uuid("experiment_id").notNull(),
  experimentType: text("experiment_type", { enum: ["NAAT", "LFA"] }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  s3Key: varchar("s3_key", { length: 512 }).notNull(),
  contentType: varchar("content_type", { length: 100 }),
  fileSize: integer("file_size"),
  uploadedBy: uuid("uploaded_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const naatLiquidTypes = pgTable("naat_liquid_type", {
  id: uuid("id").defaultRandom().primaryKey(),
  value: varchar("value", { length: 100 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  needsTipWashing: boolean("needs_tip_washing").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastUpdatedBy: uuid("last_updated_by")
    .references(() => users.id)
    .notNull(),
});

export const lfaLiquidTypes = pgTable("lfa_liquid_type", {
  id: uuid("id").defaultRandom().primaryKey(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  value: varchar("value", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastUpdatedBy: uuid("last_updated_by")
    .references(() => users.id)
    .notNull(),
});

export const volumeUnits = pgTable("naat_volume_unit", {
  id: uuid("id").defaultRandom().primaryKey(),
  unit: varchar("unit", { length: 50 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastUpdatedBy: uuid("last_updated_by")
    .references(() => users.id)
    .notNull(),
});

export const deckLayouts = pgTable("naat_deck_layout", {
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

export const lfaExperiments = pgTable("lfa_experiment", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  numReplicates: integer("num_replicates").notNull(),
  deckLayoutId: uuid("deck_layout_id")
    .references(() => lfaDeckLayouts.id)
    .notNull(),
  assayPlateConfigId: uuid("assay_plate_config_id")
    .references(() => assayPlateConfigs.id)
    .notNull(),
  ownerId: uuid("owner_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const lfaSteps = pgTable("lfa_step", {
  id: uuid("id").defaultRandom().primaryKey(),
  experimentId: uuid("experiment_id").references(() => lfaExperiments.id),
  step: varchar("step", { length: 100 }).notNull(),
  dx: real("dx").notNull(),
  dz: real("dz").notNull(),
  volume: real("volume").notNull(),
  liquidClass: varchar("liquid_class", { length: 50 }).notNull(),
  time: real("time").notNull(),
  source: text("source").notNull(),
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type PlateLocation = {
  dx: number;
  dz: number;
};

export const assayPlateConfigs = pgTable("assay_plate_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  assayPlatePrefix: varchar("assay_plate_prefix", { length: 50 }).notNull(),
  deviceType: varchar("device_type", { length: 20 })
    .notNull()
    .$type<"Strip" | "Cassette">()
    .default("Strip"),
  numPlates: integer("num_plates").notNull(),
  numRows: integer("num_rows").notNull(),
  numColumns: integer("num_columns").notNull(),
  locations: jsonb("locations").notNull().$type<PlateLocation[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const reagentPlates = pgTable("lfa_reagent_plate", {
  id: uuid("id").defaultRandom().primaryKey(),
  plate: varchar("plate", { length: 255 }).notNull().unique(),
  volumeWell: real("volume_well").notNull(),
  numRows: integer("num_rows").notNull(),
  numCols: integer("num_cols").notNull(),
  volumeHoldover: real("volume_holdover").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastUpdatedBy: uuid("last_updated_by").references(() => users.id),
});

export const lfaDeckLayouts = pgTable("lfa_deck_layout", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  platePositions: jsonb("plate_positions").notNull().$type<
    Array<{
      id: string;
      name: string;
      isEmpty?: boolean;
      wellCount: number;
      plateDescriptor: string;
      sequenceNumber: string;
    }>
  >(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

export const naatPresets = pgTable("naat_preset", {
  id: uuid("id").defaultRandom().primaryKey(),
  experimentId: uuid("experiment_id").references(() => naatExperiments.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const lfaPresets = pgTable("lfa_preset", {
  id: uuid("id").defaultRandom().primaryKey(),
  experimentId: uuid("experiment_id").references(() => lfaExperiments.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
}));

export const masterMixesRelations = relations(masterMixes, ({ one, many }) => ({
  experimentalPlan: one(naatExperiments, {
    fields: [masterMixes.experimentalPlanId],
    references: [naatExperiments.id],
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
  naatExperiments,
  ({ one, many }) => ({
    owner: one(users, {
      fields: [naatExperiments.ownerId],
      references: [users.id],
    }),
    deckLayout: one(deckLayouts, {
      fields: [naatExperiments.deckLayoutId],
      references: [deckLayouts.id],
    }),
    preset: one(naatPresets, {
      fields: [naatExperiments.id],
      references: [naatPresets.experimentId],
    }),
    masterMixes: many(masterMixes),
    files: many(experimentFiles, { relationName: "naatExperimentFiles" }),
  })
);

export const naatPresetsRelations = relations(naatPresets, ({ one }) => ({
  experiment: one(naatExperiments, {
    fields: [naatPresets.experimentId],
    references: [naatExperiments.id],
  }),
}));

export const deckLayoutsRelations = relations(deckLayouts, ({ one }) => ({
  creator: one(users, {
    fields: [deckLayouts.createdBy],
    references: [users.id],
  }),
}));

export const lfaDeckLayoutRelations = relations(lfaDeckLayouts, ({ one }) => ({
  creator: one(users, {
    fields: [lfaDeckLayouts.createdBy],
    references: [users.id],
  }),
}));

export const lfaExperimentsRelations = relations(
  lfaExperiments,
  ({ one, many }) => ({
    deckLayout: one(lfaDeckLayouts, {
      fields: [lfaExperiments.deckLayoutId],
      references: [lfaDeckLayouts.id],
    }),
    assayPlateConfig: one(assayPlateConfigs, {
      fields: [lfaExperiments.assayPlateConfigId],
      references: [assayPlateConfigs.id],
    }),
    steps: many(lfaSteps),
    owner: one(users, {
      fields: [lfaExperiments.ownerId],
      references: [users.id],
    }),
    files: many(experimentFiles, { relationName: "lfaExperimentFiles" }),
    preset: one(lfaPresets, {
      fields: [lfaExperiments.id],
      references: [lfaPresets.experimentId],
    }),
  })
);

export const lfaStepsRelations = relations(lfaSteps, ({ one }) => ({
  experiment: one(lfaExperiments, {
    fields: [lfaSteps.experimentId],
    references: [lfaExperiments.id],
  }),
}));

export const experimentFilesRelations = relations(
  experimentFiles,
  ({ one }) => ({
    naatExperiment: one(naatExperiments, {
      fields: [experimentFiles.experimentId],
      references: [naatExperiments.id],
      relationName: "naatExperimentFiles",
    }),
    lfaExperiment: one(lfaExperiments, {
      fields: [experimentFiles.experimentId],
      references: [lfaExperiments.id],
      relationName: "lfaExperimentFiles",
    }),
    uploader: one(users, {
      fields: [experimentFiles.uploadedBy],
      references: [users.id],
    }),
  })
);

export const lfaPresetsRelations = relations(lfaPresets, ({ one }) => ({
  experiment: one(lfaExperiments, {
    fields: [lfaPresets.experimentId],
    references: [lfaExperiments.id],
  }),
}));
