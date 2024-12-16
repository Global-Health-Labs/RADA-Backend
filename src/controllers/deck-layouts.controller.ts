import { Request, Response } from "express";
import { db } from "../db";
import { deckLayouts } from "../db/schema";
import { eq } from "drizzle-orm";

export async function getDeckLayouts(req: Request, res: Response) {
  try {
    const layouts = await db.query.deckLayouts.findMany({
      with: {
        creator: {
          columns: {
            fullname: true,
          },
        },
      },
    });
    res.json(layouts);
  } catch (error) {
    console.error("Error fetching deck layouts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getDeckLayout(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const layout = await db.query.deckLayouts.findFirst({
      where: eq(deckLayouts.id, id),
      with: {
        creator: {
          columns: {
            fullname: true,
          },
        },
      },
    });

    if (!layout) {
      return res.status(404).json({ error: "Deck layout not found" });
    }

    res.json(layout);
  } catch (error) {
    console.error("Error fetching deck layout:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createDeckLayout(req: Request, res: Response) {
  try {
    const { name, description, platePositions } = req.body;

    const newLayout = await db
      .insert(deckLayouts)
      .values({
        name,
        description,
        platePositions,
        createdBy: req.user!.id,
      })
      .returning();

    res.status(201).json(newLayout[0]);
  } catch (error) {
    console.error("Error creating deck layout:", error);
    if ((error as any).code === "23505") {
      return res
        .status(400)
        .json({ error: "A deck layout with this name already exists" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateDeckLayout(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, platePositions } = req.body;

    const existingLayout = await db.query.deckLayouts.findFirst({
      where: eq(deckLayouts.id, id),
    });

    if (!existingLayout) {
      return res.status(404).json({ error: "Deck layout not found" });
    }

    const updatedLayout = await db
      .update(deckLayouts)
      .set({
        name,
        description,
        platePositions,
        updatedAt: new Date(),
      })
      .where(eq(deckLayouts.id, id))
      .returning();

    res.json(updatedLayout[0]);
  } catch (error) {
    console.error("Error updating deck layout:", error);
    if ((error as any).code === "23505") {
      return res
        .status(400)
        .json({ error: "A deck layout with this name already exists" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
}
