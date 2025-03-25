import { Router } from "express";
import { validateRequest } from "../middlewares/validate-request";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db } from "../db";
import { lfaLiquidTypes, reagentPlates } from "../db/schema";
import {
  createLFAConfig,
  getLFAConfigs,
  updateLFAConfig,
  deleteLFAConfig,
  getReagentPlates,
  createReagentPlate,
  updateReagentPlate,
  deleteReagentPlate,
  getLFADeckLayouts,
  createLFADeckLayout,
  updateLFADeckLayout,
  deleteLFADeckLayout,
} from "../controllers/lfa-settings.controller";

const router = Router();

const locationSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be at most 100 characters"),
  dx: z.number().min(0, "X offset must be non-negative"),
  dz: z.number().min(0, "Z offset must be non-negative"),
});

const assayPatConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  assayPlatePrefix: z.string().min(1, "Plate prefix is required"),
  numPlates: z.number().min(1, "Must have at least 1 plate"),
  numRows: z.number().min(1, "Must have at least 1 row"),
  numColumns: z.number().min(1, "Must have at least 1 column"),
  deviceType: z.enum(["Strip", "Cassette"]),
  locations: z
    .array(locationSchema)
    .min(1, "At least one location is required"),
});

const liquidTypeSchema = z.object({
  value: z.string().min(1),
  displayName: z.string().min(1),
});

const reagentPlateSchema = z.object({
  plate: z.string().min(1, "Plate name is required"),
  volumeWell: z.number().min(0, "Well volume must be positive"),
  numRows: z.number().min(1, "Must have at least 1 row"),
  numCols: z.number().min(1, "Must have at least 1 column"),
  volumeHoldover: z.number().min(0, "Holdover volume must be non-negative"),
});

const deckLayoutSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  platePositions: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      isEmpty: z.boolean().optional(),
      wellCount: z.number(),
      plateDescriptor: z.string(),
      sequenceNumber: z.string(),
    })
  ),
  assayPlateConfigId: z.string().uuid("Invalid assay plate config ID"),
});

// Get all configurations
router.get("/assay-plate-configs", getLFAConfigs);

// Create new configuration
router.post(
  "/assay-plate-configs",
  validateRequest({
    body: assayPatConfigSchema.omit({ id: true }),
  }),
  createLFAConfig
);

// Update configuration
router.put(
  "/assay-plate-configs/:id",
  validateRequest({
    body: assayPatConfigSchema.omit({ id: true }),
    params: z.object({
      id: z.string(),
    }),
  }),
  updateLFAConfig
);

// Delete configuration
router.delete(
  "/assay-plate-configs/:id",
  validateRequest({
    params: z.object({
      id: z.string(),
    }),
  }),
  deleteLFAConfig
);

// GET /settings/lfa/liquid-types
router.get("/liquid-types", async (req, res) => {
  const types = await db
    .select()
    .from(lfaLiquidTypes)
    .orderBy(lfaLiquidTypes.displayName);
  res.json(types);
});

// POST /settings/lfa/liquid-types
router.post("/liquid-types", async (req, res) => {
  try {
    const { value, displayName } = liquidTypeSchema.parse(req.body);

    // Check if value already exists
    const existing = await db
      .select()
      .from(lfaLiquidTypes)
      .where(eq(lfaLiquidTypes.value, value))
      .limit(1);

    if (existing.length > 0) {
      return res
        .status(409)
        .json({ message: "Liquid type with this value already exists" });
    }

    const [newType] = await db
      .insert(lfaLiquidTypes)
      .values({
        value,
        displayName,
        lastUpdatedBy: req.user!.id,
      })
      .returning();

    res.status(201).json(newType);
  } catch (error) {
    console.error("Error creating LFA liquid type:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input data", error });
    }
    res.status(500).json({ message: "Failed to create LFA liquid type" });
  }
});

// PUT /settings/lfa/liquid-types/:id
router.put("/liquid-types/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { value, displayName } = liquidTypeSchema.parse(req.body);

    // Check if value already exists for a different ID
    const existing = await db
      .select()
      .from(lfaLiquidTypes)
      .where(
        and(
          eq(lfaLiquidTypes.value, value),
          ne(lfaLiquidTypes.id, id) // Exclude the current type
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res
        .status(409)
        .json({ message: "Liquid type with this value already exists" });
    }

    const [updatedType] = await db
      .update(lfaLiquidTypes)
      .set({
        value,
        displayName,
        lastUpdatedBy: req.user!.id,
        updatedAt: new Date(),
      })
      .where(eq(lfaLiquidTypes.id, id))
      .returning();

    if (!updatedType) {
      return res.status(404).json({ message: "Liquid type not found" });
    }

    res.json(updatedType);
  } catch (error) {
    console.error("Error updating LFA liquid type:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input data", error });
    }
    res.status(500).json({ message: "Failed to update LFA liquid type" });
  }
});

// DELETE /settings/lfa/liquid-types/:id
router.delete("/liquid-types/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [deletedType] = await db
      .delete(lfaLiquidTypes)
      .where(eq(lfaLiquidTypes.id, id))
      .returning();

    if (!deletedType) {
      return res.status(404).json({ message: "Liquid type not found" });
    }

    res.json(deletedType);
  } catch (error) {
    console.error("Error deleting LFA liquid type:", error);
    res.status(500).json({ message: "Failed to delete LFA liquid type" });
  }
});

// Deck Layout Routes
router.get("/deck-layouts", getLFADeckLayouts);

router.post(
  "/deck-layouts",
  validateRequest({
    body: deckLayoutSchema,
  }),
  createLFADeckLayout
);

router.patch(
  "/deck-layouts/:id",
  validateRequest({
    body: deckLayoutSchema.partial(),
    params: z.object({
      id: z.string().uuid("Invalid layout ID"),
    }),
  }),
  updateLFADeckLayout
);

router.delete(
  "/deck-layouts/:id",
  validateRequest({
    params: z.object({
      id: z.string().uuid("Invalid layout ID"),
    }),
  }),
  deleteLFADeckLayout
);

// Reagent Plates Routes

// Get all reagent plates
router.get("/reagent-plates", getReagentPlates);

// Create new reagent plate
router.post(
  "/reagent-plates",
  validateRequest({
    body: reagentPlateSchema,
  }),
  createReagentPlate
);

// Update reagent plate
router.put(
  "/reagent-plates/:id",
  validateRequest({
    body: reagentPlateSchema,
    params: z.object({
      id: z.string().uuid(),
    }),
  }),
  updateReagentPlate
);

// Delete reagent plate
router.delete(
  "/reagent-plates/:id",
  validateRequest({
    params: z.object({
      id: z.string().uuid(),
    }),
  }),
  deleteReagentPlate
);

export default router;
