import { Request, Response } from "express";
import { db } from "../db";
import { and, eq, ne } from "drizzle-orm";
import { assayPlateConfigs, reagentPlates, lfaDeckLayouts } from "../db/schema";
import { v4 as uuidv4 } from "uuid";

export async function getLFAConfigs(req: Request, res: Response) {
  try {
    const configs = await db.query.assayPlateConfigs.findMany();
    return res.json(configs);
  } catch (error) {
    console.error("Error fetching LFA configs:", error);
    return res.status(500).json({ message: "Failed to fetch configurations" });
  }
}

export async function createLFAConfig(req: Request, res: Response) {
  const configData = req.body;

  try {
    const newConfig = await db
      .insert(assayPlateConfigs)
      .values({
        name: configData.name,
        description: configData.description,
        assayPlatePrefix: configData.assayPlatePrefix,
        deviceType: configData.deviceType,
        numPlates: configData.numPlates,
        numRows: configData.numRows,
        numColumns: configData.numColumns,
        locations: configData.locations,
      })
      .returning();

    return res.status(201).json(newConfig[0]);
  } catch (error) {
    console.error("Error creating LFA config:", error);
    return res.status(500).json({ message: "Failed to create configuration" });
  }
}

export async function updateLFAConfig(req: Request, res: Response) {
  const { id } = req.params;
  const configData = req.body;
  try {
    const updatedConfig = await db
      .update(assayPlateConfigs)
      .set({
        name: configData.name,
        description: configData.description,
        assayPlatePrefix: configData.assayPlatePrefix,
        deviceType: configData.deviceType,
        numPlates: configData.numPlates,
        numRows: configData.numRows,
        numColumns: configData.numColumns,
        locations: configData.locations,
      })
      .where(eq(assayPlateConfigs.id, id))
      .returning();

    if (updatedConfig.length === 0) {
      return res.status(404).json({ message: "Configuration not found" });
    }

    return res.json(updatedConfig[0]);
  } catch (error) {
    console.error("Error updating LFA config:", error);
    return res.status(500).json({ message: "Failed to update configuration" });
  }
}

export async function deleteLFAConfig(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const deletedConfig = await db
      .delete(assayPlateConfigs)
      .where(eq(assayPlateConfigs.id, id))
      .returning();

    if (deletedConfig.length === 0) {
      return res.status(404).json({ message: "Configuration not found" });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting LFA config:", error);
    return res.status(500).json({ message: "Failed to delete configuration" });
  }
}

export async function getReagentPlates(req: Request, res: Response) {
  try {
    const plates = await db.query.reagentPlates.findMany({
      orderBy: (plates, { desc }) => [desc(plates.createdAt)],
    });
    res.json(plates);
  } catch (error) {
    console.error("Error fetching reagent plates:", error);
    res.status(500).json({ error: "Failed to fetch reagent plates" });
  }
}

export async function createReagentPlate(req: Request, res: Response) {
  const { plate, volumeWell, numRows, numCols, volumeHoldover } = req.body;

  try {
    // Check for duplicate plate name
    const existingPlate = await db.query.reagentPlates.findFirst({
      where: eq(reagentPlates.plate, plate),
    });

    if (existingPlate) {
      return res
        .status(409)
        .json({ error: "A reagent plate with this name already exists" });
    }

    const [newPlate] = await db
      .insert(reagentPlates)
      .values({
        plate,
        volumeWell,
        numRows,
        numCols,
        volumeHoldover,
        lastUpdatedBy: req.user?.id,
      })
      .returning();

    res.status(201).json(newPlate);
  } catch (error) {
    console.error("Error creating reagent plate:", error);
    res.status(500).json({ error: "Failed to create reagent plate" });
  }
}

export async function updateReagentPlate(req: Request, res: Response) {
  const { id } = req.params;
  const { plate, volumeWell, numRows, numCols, volumeHoldover } = req.body;

  try {
    // Check for duplicate plate name, excluding current plate
    const existingPlate = await db.query.reagentPlates.findFirst({
      where: and(eq(reagentPlates.plate, plate), ne(reagentPlates.id, id)),
    });

    if (existingPlate) {
      return res
        .status(409)
        .json({ error: "A reagent plate with this name already exists" });
    }

    const [updatedPlate] = await db
      .update(reagentPlates)
      .set({
        plate,
        volumeWell,
        numRows,
        numCols,
        volumeHoldover,
        updatedAt: new Date(),
        lastUpdatedBy: req.user?.id,
      })
      .where(eq(reagentPlates.id, id))
      .returning();

    if (!updatedPlate) {
      return res.status(404).json({ error: "Reagent plate not found" });
    }

    res.json(updatedPlate);
  } catch (error) {
    console.error("Error updating reagent plate:", error);
    res.status(500).json({ error: "Failed to update reagent plate" });
  }
}

export async function deleteReagentPlate(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const [deletedPlate] = await db
      .delete(reagentPlates)
      .where(eq(reagentPlates.id, id))
      .returning();

    if (!deletedPlate) {
      return res.status(404).json({ error: "Reagent plate not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting reagent plate:", error);
    res.status(500).json({ error: "Failed to delete reagent plate" });
  }
}

export async function getLFADeckLayouts(req: Request, res: Response) {
  try {
    const layouts = await db.query.lfaDeckLayouts.findMany({
      with: {
        assayPlateConfig: true,
        creator: {
          columns: {
            fullname: true,
          },
        },
      },
      orderBy: (layouts, { desc }) => [desc(layouts.createdAt)],
    });

    res.json(layouts);
  } catch (error) {
    console.error("Error fetching LFA deck layouts:", error);
    res.status(500).json({ message: "Failed to fetch deck layouts" });
  }
}

export async function createLFADeckLayout(req: Request, res: Response) {
  try {
    const { name, description, platePositions, assayPlateConfigId } = req.body;

    // Check if name is already taken
    const existingLayout = await db.query.lfaDeckLayouts.findFirst({
      where: (layouts, { eq }) => eq(layouts.name, name),
    });

    if (existingLayout) {
      return res.status(400).json({ message: "Layout name already exists" });
    }

    // Create new layout
    const [layout] = await db
      .insert(lfaDeckLayouts)
      .values({
        name,
        description,
        platePositions,
        assayPlateConfigId,
        createdBy: req.user?.id,
      })
      .returning();

    const layoutWithRelations = await db.query.lfaDeckLayouts.findFirst({
      where: (layouts, { eq }) => eq(layouts.id, layout.id),
      with: {
        assayPlateConfig: true,
        creator: {
          columns: {
            fullname: true,
          },
        },
      },
    });

    res.status(201).json(layoutWithRelations);
  } catch (error) {
    console.error("Error creating LFA deck layout:", error);
    res.status(500).json({ message: "Failed to create deck layout" });
  }
}

export async function updateLFADeckLayout(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, platePositions, assayPlateConfigId } = req.body;

    // Check if layout exists
    const existingLayout = await db.query.lfaDeckLayouts.findFirst({
      where: (layouts, { eq }) => eq(layouts.id, id),
    });

    if (!existingLayout) {
      return res.status(404).json({ message: "Layout not found" });
    }

    // Check if new name is already taken by another layout
    if (name !== existingLayout.name) {
      const nameExists = await db.query.lfaDeckLayouts.findFirst({
        where: (layouts, { eq, and, ne }) =>
          and(eq(layouts.name, name), ne(layouts.id, id)),
      });

      if (nameExists) {
        return res.status(400).json({ message: "Layout name already exists" });
      }
    }

    // Update layout
    const [updatedLayout] = await db
      .update(lfaDeckLayouts)
      .set({
        name,
        description,
        platePositions,
        assayPlateConfigId,
        updatedAt: new Date(),
      })
      .where(eq(lfaDeckLayouts.id, id))
      .returning();

    const layoutWithRelations = await db.query.lfaDeckLayouts.findFirst({
      where: (layouts, { eq }) => eq(layouts.id, updatedLayout.id),
      with: {
        assayPlateConfig: true,
        creator: {
          columns: {
            fullname: true,
          },
        },
      },
    });

    res.json(layoutWithRelations);
  } catch (error) {
    console.error("Error updating LFA deck layout:", error);
    res.status(500).json({ message: "Failed to update deck layout" });
  }
}

export async function deleteLFADeckLayout(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Check if layout exists
    const existingLayout = await db.query.lfaDeckLayouts.findFirst({
      where: (layouts, { eq }) => eq(layouts.id, id),
    });

    if (!existingLayout) {
      return res.status(404).json({ message: "Layout not found" });
    }

    // Delete layout
    await db.delete(lfaDeckLayouts).where(eq(lfaDeckLayouts.id, id));

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting LFA deck layout:", error);
    res.status(500).json({ message: "Failed to delete deck layout" });
  }
}
