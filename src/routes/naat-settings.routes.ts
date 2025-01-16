import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { naatLiquidTypes, volumeUnits } from "../db/schema";
import { authenticateToken, requireAdmin } from "../middleware/auth";
import {
  getDeckLayouts,
  getDeckLayout,
  createDeckLayout,
  updateDeckLayout,
} from "../controllers/deck-layouts.controller";

const router = Router();

const liquidTypeSchema = z.object({
  value: z.string().min(1),
  displayName: z.string().min(1),
});

const volumeUnitSchema = z.object({
  unit: z.string().min(1),
});

// GET /settings/naat/liquid-types
router.get("/liquid-types", async (req, res) => {
  const types = await db
    .select()
    .from(naatLiquidTypes)
    .orderBy(naatLiquidTypes.displayName);
  res.json(types);
});

// POST /settings/naat/liquid-types
router.post("/liquid-types", async (req, res) => {
  try {
    const { value, displayName } = liquidTypeSchema.parse(req.body);

    // Check if value already exists
    const existing = await db
      .select()
      .from(naatLiquidTypes)
      .where(eq(naatLiquidTypes.value, value))
      .limit(1);

    if (existing.length > 0) {
      return res
        .status(400)
        .json({ message: "Liquid type with this value already exists" });
    }

    const [newType] = await db
      .insert(naatLiquidTypes)
      .values({
        value,
        displayName,
        lastUpdatedBy: req.user!.id,
      })
      .returning();

    res.status(201).json(newType);
  } catch (error: any) {
    console.error("Error creating liquid type:", error);

    // Check for validation errors from Zod
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Invalid input data",
        error: error.errors,
      });
    }

    // Check if error message indicates a unique constraint violation
    if (
      error.message?.toLowerCase().includes("unique") ||
      error.message?.toLowerCase().includes("duplicate") ||
      error.message?.toLowerCase().includes("violation")
    ) {
      return res.status(409).json({
        message: "A liquid type with this value already exists",
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Failed to create liquid type",
      error: error.message,
    });
  }
});

// PUT /settings/naat/liquid-types/:id
router.put("/liquid-types/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { value, displayName } = liquidTypeSchema.parse(req.body);

    // Check if value already exists for a different ID
    const existing = await db
      .select()
      .from(naatLiquidTypes)
      .where(eq(naatLiquidTypes.value, value))
      .limit(1);

    if (existing.length > 0 && existing[0].id !== id) {
      return res
        .status(400)
        .json({ message: "Liquid type with this value already exists" });
    }

    const [updatedType] = await db
      .update(naatLiquidTypes)
      .set({
        value,
        displayName,
        lastUpdatedBy: req.user!.id,
      })
      .where(eq(naatLiquidTypes.id, id))
      .returning();

    if (!updatedType) {
      return res.status(404).json({ message: "Liquid type not found" });
    }

    res.json(updatedType);
  } catch (error: any) {
    console.error("Error updating liquid type:", error);

    // Check for validation errors from Zod
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Invalid input data",
        error: error.errors,
      });
    }

    // Check if error message indicates a unique constraint violation
    if (
      error.message?.toLowerCase().includes("unique") ||
      error.message?.toLowerCase().includes("duplicate") ||
      error.message?.toLowerCase().includes("violation")
    ) {
      return res.status(409).json({
        message: "A liquid type with this value already exists",
        error: error.message,
      });
    }

    // Check for invalid ID format
    if (
      error.message?.toLowerCase().includes("invalid") &&
      error.message?.toLowerCase().includes("id")
    ) {
      return res.status(400).json({
        message: "Invalid liquid type ID format",
        error: error.message,
      });
    }

    res.status(500).json({
      message: "Failed to update liquid type",
      error: error.message,
    });
  }
});

// DELETE /settings/naat/liquid-types/:id
router.delete("/liquid-types/:id", async (req, res) => {
  const { id } = req.params;

  const [deletedType] = await db
    .delete(naatLiquidTypes)
    .where(eq(naatLiquidTypes.id, id))
    .returning();

  if (!deletedType) {
    return res.status(404).json({ message: "Liquid type not found" });
  }

  res.json(deletedType);
});

// Volume Units Endpoints
// GET /settings/naat/volume-units
router.get("/volume-units", async (req, res) => {
  const units = await db.select().from(volumeUnits).orderBy(volumeUnits.unit);
  res.json(units);
});

// POST /settings/naat/volume-units
router.post("/volume-units", async (req, res) => {
  try {
    const { unit } = volumeUnitSchema.parse(req.body);

    // Check if unit already exists
    const existing = await db
      .select()
      .from(volumeUnits)
      .where(eq(volumeUnits.unit, unit))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ message: "Volume unit already exists" });
    }

    const [newUnit] = await db
      .insert(volumeUnits)
      .values({
        unit,
        lastUpdatedBy: req.user!.id,
      })
      .returning();

    res.status(201).json(newUnit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /settings/naat/volume-units/:id
router.put("/volume-units/:id", async (req, res) => {
  try {
    const { unit } = volumeUnitSchema.parse(req.body);
    const { id } = req.params;

    // Check if unit already exists for other records
    const existing = await db
      .select()
      .from(volumeUnits)
      .where(eq(volumeUnits.unit, unit))
      .limit(1);

    if (existing.length > 0 && existing[0].id !== id) {
      return res.status(400).json({ message: "Volume unit already exists" });
    }

    const [updatedUnit] = await db
      .update(volumeUnits)
      .set({
        unit,
        updatedAt: new Date(),
        lastUpdatedBy: req.user!.id,
      })
      .where(eq(volumeUnits.id, id))
      .returning();

    if (!updatedUnit) {
      return res.status(404).json({ message: "Volume unit not found" });
    }

    res.json(updatedUnit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /settings/naat/volume-units/:id
router.delete("/volume-units/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [deletedUnit] = await db
      .delete(volumeUnits)
      .where(eq(volumeUnits.id, id))
      .returning();

    if (!deletedUnit) {
      return res.status(404).json({ message: "Volume unit not found" });
    }

    res.json(deletedUnit);
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// Deck Layout Routes
router.get("/deck-layouts", getDeckLayouts);
router.get("/deck-layouts/:id", getDeckLayout);
router.post("/deck-layouts", createDeckLayout);
router.put("/deck-layouts/:id", updateDeckLayout);

export default router;
