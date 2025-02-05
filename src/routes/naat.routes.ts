import { and, eq, or, desc } from "drizzle-orm";
import { Request, Response, Router } from "express";
import { DISPENSE_TYPES } from "../constants";
import { db } from "../db";
import {
  deckLayouts,
  naatLiquidTypes,
  masterMixes,
  masterMixRecipes,
  naatExperiments,
  users,
} from "../db/schema";
import { authenticateToken } from "../middleware/auth";

const router = Router();
// Helper function to fetch and format mastermixes
async function getMastermixesForExperiment(experimentId: string) {
  const mastermixes = await db
    .select()
    .from(masterMixes)
    .where(eq(masterMixes.experimentalPlanId, experimentId));

  let recipes: (typeof masterMixRecipes.$inferSelect)[] = [];
  if (mastermixes.length > 0) {
    recipes = await db
      .select()
      .from(masterMixRecipes)
      .where(
        or(...mastermixes.map((m) => eq(masterMixRecipes.mastermixId, m.id)))
      )
      .orderBy(masterMixRecipes.orderIndex);
  }

  return {
    experimentId,
    mastermixes: mastermixes.map((mix) => ({
      id: mix.id,
      name: mix.nameOfMastermix,
      orderIndex: mix.orderIndex,
      reagents: recipes
        .filter((recipe) => recipe.mastermixId === mix.id)
        .map((recipe) => ({
          id: recipe.id,
          source: recipe.finalSource,
          unit: recipe.unit,
          finalConcentration: recipe.finalConcentration,
          stockConcentration: recipe.stockConcentration,
          liquidType: recipe.liquidType,
          dispenseType: recipe.dispenseType,
          orderIndex: recipe.orderIndex,
          tipWashing: recipe.tipWashing,
        })),
    })),
  };
}

// Helper function to format experiment data for client
async function formatExperimentData(
  experiment: typeof naatExperiments.$inferSelect,
  ownerName: string,
  excludeRecipes: boolean = false
) {
  // Get deck layout if it exists
  let deckLayout = undefined;
  if (experiment.deckLayoutId && !excludeRecipes) {
    const layouts = await db
      .select()
      .from(deckLayouts)
      .where(eq(deckLayouts.id, experiment.deckLayoutId))
      .limit(1);
    if (layouts.length > 0) {
      deckLayout = layouts[0];
    }
  }

  const mastermixesWithRecipes = excludeRecipes
    ? undefined
    : await getMastermixesForExperiment(experiment.id);

  return {
    id: experiment.id,
    name: experiment.name,
    numOfSampleConcentrations: experiment.numOfSampleConcentrations,
    numOfTechnicalReplicates: experiment.numOfTechnicalReplicates,
    mastermixVolumePerReaction: experiment.mastermixVolumePerReaction,
    sampleVolumePerReaction: experiment.sampleVolumePerReaction,
    pcrPlateSize: experiment.pcrPlateSize,
    deckLayout,
    deckLayoutId: experiment.deckLayoutId,
    mastermixes: mastermixesWithRecipes?.mastermixes,
    ownerFullName: ownerName,
    createdAt: experiment.createdAt,
    updatedAt: experiment.updatedAt,
    type: "NAAT",
  };
}

// Get single experiment
router.get(
  "/:experimentId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { experimentId } = req.params;

      const experiment = await db
        .select({
          experiment: naatExperiments,
          owner: users,
        })
        .from(naatExperiments)
        .leftJoin(users, eq(naatExperiments.ownerId, users.id))
        .where(eq(naatExperiments.id, experimentId));

      if (experiment.length === 0) {
        return res.status(404).json({ message: "Experiment not found" });
      }

      const formattedExperiment = await formatExperimentData(
        experiment[0].experiment,
        experiment[0].owner?.fullname || "Owner not found"
      );

      res.json(formattedExperiment);
    } catch (error: any) {
      console.error("Get experiment error:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch experiment", error: error.message });
    }
  }
);

// Create new experiment
router.post("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const {
      name,
      numOfSampleConcentrations,
      numOfTechnicalReplicates,
      mastermixVolumePerReaction,
      sampleVolumePerReaction,
      pcrPlateSize,
      deckLayoutId,
    } = req.body;

    const newExperiment = await db
      .insert(naatExperiments)
      .values({
        name,
        numOfSampleConcentrations,
        numOfTechnicalReplicates,
        mastermixVolumePerReaction,
        sampleVolumePerReaction,
        pcrPlateSize,
        deckLayoutId,
        ownerId: req.user!.id,
      })
      .returning();

    res.status(201).json(newExperiment[0]);
  } catch (error: any) {
    console.error("Create experiment error:", error);
    res
      .status(500)
      .json({ message: "Failed to create experiment", error: error.message });
  }
});

// Add mastermix to experiment
router.post(
  "/:experimentId/mastermixes",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { experimentId } = req.params;
      const { nameOfMasterMix, recipes } = req.body;

      // Get current max order index
      const maxOrderIndex = await db
        .select({
          maxOrder: masterMixes.orderIndex,
        })
        .from(masterMixes)
        .where(eq(masterMixes.experimentalPlanId, experimentId))
        .orderBy(desc(masterMixes.orderIndex))
        .limit(1);

      const allLiquidTypes = await db.select().from(naatLiquidTypes);

      const newOrderIndex = (maxOrderIndex[0]?.maxOrder || 0) + 1;

      // Create mastermix
      const newMastermix = await db
        .insert(masterMixes)
        .values({
          experimentalPlanId: experimentId,
          nameOfMastermix: nameOfMasterMix,
          orderIndex: newOrderIndex,
        })
        .returning();

      // Add recipes
      if (recipes && recipes.length > 0) {
        for (let i = 0; i < recipes.length; i++) {
          const recipe = recipes[i];
          const recipeLiquidType = allLiquidTypes.find(
            (lt) => lt.value === recipe.liquidType
          );

          await db.insert(masterMixRecipes).values({
            mastermixId: newMastermix[0].id,
            orderIndex: i + 1,
            finalSource: recipe.finalSource,
            unit: recipe.unit,
            finalConcentration: recipe.finalConcentration,
            tipWashing: recipeLiquidType?.needsTipWashing ? "Yes" : "No",
            stockConcentration: recipe.stockConcentration,
            liquidType: recipe.liquidType,
            dispenseType: recipe.dispenseType,
          });
        }
      }

      res.status(201).json(newMastermix[0]);
    } catch (error: any) {
      console.error("Add mastermix error:", error);
      res
        .status(500)
        .json({ message: "Failed to add mastermix", error: error.message });
    }
  }
);

// Update experiment
router.put(
  "/:experimentId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { experimentId } = req.params;
      const {
        name,
        numOfSampleConcentrations,
        numOfTechnicalReplicates,
        mastermixVolumePerReaction,
        sampleVolumePerReaction,
        pcrPlateSize,
        deckLayoutId,
      } = req.body;

      const updatedExperiment = await db
        .update(naatExperiments)
        .set({
          name,
          numOfSampleConcentrations,
          numOfTechnicalReplicates,
          mastermixVolumePerReaction,
          sampleVolumePerReaction,
          pcrPlateSize,
          deckLayoutId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(naatExperiments.id, experimentId),
            eq(naatExperiments.ownerId, req.user!.id)
          )
        )
        .returning();

      if (updatedExperiment.length === 0) {
        return res.status(404).json({ message: "Experiment not found" });
      }

      res.json(updatedExperiment[0]);
    } catch (error: any) {
      console.error("Update experiment error:", error);
      res
        .status(500)
        .json({ message: "Failed to update experiment", error: error.message });
    }
  }
);

// Update mastermix
router.put(
  "/mastermixes/:mastermixId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { mastermixId } = req.params;
      const { nameOfMasterMix, recipes } = req.body;

      const allLiquidTypes = await db.select().from(naatLiquidTypes);

      const updatedMastermix = await db
        .update(masterMixes)
        .set({
          nameOfMastermix: nameOfMasterMix,
          updatedAt: new Date(),
        })
        .where(eq(masterMixes.id, mastermixId))
        .returning();

      if (updatedMastermix.length === 0) {
        return res.status(404).json({ message: "Mastermix not found" });
      }

      // Update recipes if provided
      if (recipes && recipes.length > 0) {
        // Delete existing recipes
        await db
          .delete(masterMixRecipes)
          .where(eq(masterMixRecipes.mastermixId, mastermixId));

        // Add new recipes
        for (let i = 0; i < recipes.length; i++) {
          const recipe = recipes[i];
          const recipeLiquidType = allLiquidTypes.find(
            (l) => l.value === recipe.liquidType
          );
          await db.insert(masterMixRecipes).values({
            mastermixId,
            orderIndex: i + 1,
            finalSource: recipe.finalSource,
            unit: recipe.unit,
            finalConcentration: recipe.finalConcentration,
            tipWashing: recipeLiquidType?.needsTipWashing ? "Yes" : "No",
            stockConcentration: recipe.stockConcentration,
            liquidType: recipe.liquidType,
            dispenseType: recipe.dispenseType,
          });
        }
      }

      res.json(updatedMastermix[0]);
    } catch (error: any) {
      console.error("Update mastermix error:", error);
      res
        .status(500)
        .json({ message: "Failed to update mastermix", error: error.message });
    }
  }
);

// Get mastermix for an experiment
router.get(
  "/:experimentId/mastermix",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { experimentId } = req.params;

      // First verify the experiment exists and belongs to the user
      const experiment = await db
        .select()
        .from(naatExperiments)
        .where(
          and(
            eq(naatExperiments.id, experimentId),
            eq(naatExperiments.ownerId, req.user!.id)
          )
        )
        .limit(1);

      if (experiment.length === 0) {
        return res.status(404).json({ message: "Experiment not found" });
      }

      const response = await getMastermixesForExperiment(experimentId);
      return res.json(response);
    } catch (error) {
      console.error("Error fetching mastermix:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Update mastermixes for an experiment
router.put("/:id/mastermix", async (req: Request, res: Response) => {
  try {
    const experimentId = req.params.id;
    const { mastermixes } = req.body;

    // Get existing mastermixes for this experiment
    const existingMastermixes = await db
      .select()
      .from(masterMixes)
      .where(eq(masterMixes.experimentalPlanId, experimentId));

    const allLiquidTypes = await db.select().from(naatLiquidTypes);

    // Find mastermixes to delete (those in DB but not in payload)
    const mastermixesToDelete = existingMastermixes.filter(
      (existing) => !mastermixes.find((m: any) => m.id === existing.id)
    );

    await db.transaction(async (tx) => {
      // Delete obsolete mastermixes and their recipes
      if (mastermixesToDelete.length > 0) {
        // First delete their recipes
        await tx
          .delete(masterMixRecipes)
          .where(
            or(
              ...mastermixesToDelete.map((m) =>
                eq(masterMixRecipes.mastermixId, m.id)
              )
            )
          );

        // Then delete the mastermixes
        await tx
          .delete(masterMixes)
          .where(
            or(...mastermixesToDelete.map((m) => eq(masterMixes.id, m.id)))
          );
      }

      // Update or create mastermixes
      for (const mastermix of mastermixes) {
        const isExisting = existingMastermixes.find(
          (m) => m.id === mastermix.id
        );

        if (isExisting) {
          // Update existing mastermix
          await tx
            .update(masterMixes)
            .set({
              nameOfMastermix: mastermix.name,
            })
            .where(eq(masterMixes.id, mastermix.id));

          // Get existing recipes for this mastermix
          const existingRecipes = await tx
            .select()
            .from(masterMixRecipes)
            .where(eq(masterMixRecipes.mastermixId, mastermix.id));

          // Delete recipes that are no longer needed
          const recipesToDelete = existingRecipes.filter(
            (existing) =>
              !mastermix.reagents.find((r: any) => r.id === existing.id)
          );

          if (recipesToDelete.length > 0) {
            await tx
              .delete(masterMixRecipes)
              .where(
                or(...recipesToDelete.map((r) => eq(masterMixRecipes.id, r.id)))
              );
          }

          // Update or create recipes
          for (const [index, reagent] of mastermix.reagents.entries()) {
            const isExistingReagent = existingRecipes.find(
              (r) => r.id === reagent.id
            );

            const recipeLiquidType = allLiquidTypes.find(
              (lt) => lt.value === reagent.liquidType
            );

            if (isExistingReagent) {
              // Update existing recipe
              await tx
                .update(masterMixRecipes)
                .set({
                  finalSource: reagent.source,
                  unit: reagent.unit,
                  finalConcentration: reagent.finalConcentration,
                  stockConcentration: reagent.stockConcentration,
                  liquidType: reagent.liquidType,
                  dispenseType:
                    index === 0
                      ? DISPENSE_TYPES.JET_EMPTY
                      : DISPENSE_TYPES.SURFACE_EMPTY,
                  tipWashing: recipeLiquidType?.needsTipWashing ? "Yes" : "No",
                  orderIndex: index + 1, // Add 1-based order index
                })
                .where(eq(masterMixRecipes.id, reagent.id));
            } else {
              // Create new recipe
              await tx.insert(masterMixRecipes).values({
                id: reagent.id,
                mastermixId: mastermix.id,
                finalSource: reagent.source,
                unit: reagent.unit,
                finalConcentration: reagent.finalConcentration,
                stockConcentration: reagent.stockConcentration,
                liquidType: reagent.liquidType,
                dispenseType:
                  index === 0
                    ? DISPENSE_TYPES.JET_EMPTY
                    : DISPENSE_TYPES.SURFACE_EMPTY,
                tipWashing: recipeLiquidType?.needsTipWashing ? "Yes" : "No",
                orderIndex: index + 1, // Add 1-based order index
              });
            }
          }
        } else {
          // Create new mastermix
          await tx.insert(masterMixes).values({
            id: mastermix.id,
            nameOfMastermix: mastermix.name,
            experimentalPlanId: experimentId,
          });

          // Create all its recipes
          if (mastermix.reagents?.length > 0) {
            await tx.insert(masterMixRecipes).values(
              mastermix.reagents.map((reagent: any, index: number) => {
                const recipeLiquidType = allLiquidTypes.find(
                  (lt) => lt.value === reagent.liquidType
                );

                return {
                  id: reagent.id,
                  mastermixId: mastermix.id,
                  finalSource: reagent.source,
                  unit: reagent.unit,
                  finalConcentration: reagent.finalConcentration,
                  stockConcentration: reagent.stockConcentration,
                  liquidType: reagent.liquidType,
                  dispenseType:
                    index === 0
                      ? DISPENSE_TYPES.JET_EMPTY
                      : DISPENSE_TYPES.SURFACE_EMPTY,
                  tipWashing: recipeLiquidType?.needsTipWashing ? "Yes" : "No",
                  orderIndex: index + 1, // Add 1-based order index
                };
              })
            );
          }
        }
      }
    });

    // Use the helper function to fetch and return updated mastermixes
    const response = await getMastermixesForExperiment(experimentId);
    res.json(response);
  } catch (error) {
    console.error("Error updating mastermixes:", error);
    res.status(500).json({ error: "Failed to update mastermixes" });
  }
});

// Clone an experiment
router.post(
  "/:id/clone",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const experimentId = req.params.id;
      const userId = req.user?.id;

      // Get the original experiment
      const originalExperiment = await db
        .select()
        .from(naatExperiments)
        .where(eq(naatExperiments.id, experimentId))
        .limit(1);

      if (!originalExperiment || originalExperiment.length === 0) {
        return res.status(404).json({ message: "Experiment not found" });
      }

      // Create new experiment with copied data
      const [newExperiment] = await db
        .insert(naatExperiments)
        .values({
          ...originalExperiment[0],
          id: undefined, // Let DB generate new ID
          ownerId: userId,
          name: `${originalExperiment[0].name} (Copy)`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Get original mastermixes
      const originalMastermixes = await db
        .select()
        .from(masterMixes)
        .where(eq(masterMixes.experimentalPlanId, experimentId));

      // Clone mastermixes and their recipes
      for (const mastermix of originalMastermixes) {
        // Create new mastermix
        const [newMastermix] = await db
          .insert(masterMixes)
          .values({
            ...mastermix,
            id: undefined, // Let DB generate new ID
            experimentalPlanId: newExperiment.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Get original recipes for this mastermix
        const originalRecipes = await db
          .select()
          .from(masterMixRecipes)
          .where(eq(masterMixRecipes.mastermixId, mastermix.id))
          .orderBy(masterMixRecipes.orderIndex);

        // Clone recipes
        if (originalRecipes.length > 0) {
          await db.insert(masterMixRecipes).values(
            originalRecipes.map((recipe) => ({
              ...recipe,
              id: undefined, // Let DB generate new ID
              mastermixId: newMastermix.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            }))
          );
        }
      }

      // Return the cloned experiment with its mastermixes
      const response = await formatExperimentData(
        newExperiment,
        req.user!.fullName
      );
      res.json(response);
    } catch (error) {
      console.error("Error cloning experiment:", error);
      res.status(500).json({ message: "Failed to clone experiment" });
    }
  }
);

export default router;
