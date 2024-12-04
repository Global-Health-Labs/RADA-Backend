import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { experimentalPlans, users, masterMixes, masterMixRecipes } from '../db/schema';
import { authenticateToken } from '../middleware/auth';

const router = Router();

const getExperimentsQuery = (userId: string, userRole: string) => {
    const query = db.select({
        experiment: experimentalPlans,
        owner: users
    })
    .from(experimentalPlans)
    .leftJoin(users, eq(experimentalPlans.ownerId, users.id))
    .orderBy(experimentalPlans.createdAt);

    // If not admin or supervisor, filter by owner
    if (!['admin', 'supervisor'].includes(userRole)) {
        return query.where(eq(experimentalPlans.ownerId, userId));
    }

    return query;
};

// Get all experiments
router.get('/', authenticateToken, async (req: Request, res: Response) => {
    try {
        const experiments = await getExperimentsQuery(req.user!.id, req.user!.role);

        const experimentsData = await Promise.all(experiments.map(async ({ experiment, owner }) => {
            // Get mastermixes for each experiment
            const mastermixes = await db.select()
                .from(masterMixes)
                .where(eq(masterMixes.experimentalPlanId, experiment.id))
                .orderBy(masterMixes.orderIndex);

            const masterMixesWithRecipes = await Promise.all(mastermixes.map(async (mastermix) => {
                const recipes = await db.select()
                    .from(masterMixRecipes)
                    .where(eq(masterMixRecipes.mastermixId, mastermix.id))
                    .orderBy(masterMixRecipes.orderIndex);

                return {
                    id: mastermix.id,
                    orderIndex: mastermix.orderIndex,
                    nameOfMasterMix: mastermix.nameOfMastermix,
                    recipes: recipes.map(recipe => ({
                        id: recipe.id,
                        orderIndex: recipe.orderIndex,
                        finalSource: recipe.finalSource,
                        unit: recipe.unit,
                        finalConcentration: recipe.finalConcentration,
                        tipWashing: recipe.tipWashing,
                        stockConcentration: recipe.stockConcentration,
                        liquidType: recipe.liquidType,
                        dispenseType: recipe.dispenseType
                    }))
                };
            }));

            return {
                id: experiment.id,
                nameOfExperimentalPlan: experiment.nameOfExperimentalPlan,
                numOfSampleConcentrations: experiment.numOfSampleConcentrations,
                numOfTechnicalReplicates: experiment.numOfTechnicalReplicates,
                mastermixVolumePerReaction: experiment.mastermixVolumePerReaction,
                sampleVolumePerReaction: experiment.sampleVolumePerReaction,
                pcrPlateSize: experiment.pcrPlateSize,
                masterMixes: masterMixesWithRecipes,
                ownerFullName: owner?.fullname || 'Owner not found',
                createdAt: experiment.createdAt,
                updatedAt: experiment.updatedAt
            };
        }));

        res.json(experimentsData);
    } catch (error: any) {
        console.error('Get experiments error:', error);
        res.status(500).json({ message: 'Failed to fetch experiments', error: error.message });
    }
});

// Get single experiment
router.get('/:experimentId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { experimentId } = req.params;

        const experiment = await db.select({
            experiment: experimentalPlans,
            owner: users
        })
        .from(experimentalPlans)
        .leftJoin(users, eq(experimentalPlans.ownerId, users.id))
        .where(eq(experimentalPlans.id, experimentId));

        if (experiment.length === 0) {
            return res.status(404).json({ message: 'Experiment not found' });
        }

        // Get mastermixes
        const mastermixes = await db.select()
            .from(masterMixes)
            .where(eq(masterMixes.experimentalPlanId, experimentId))
            .orderBy(masterMixes.orderIndex);

        const masterMixesWithRecipes = await Promise.all(mastermixes.map(async (mastermix) => {
            const recipes = await db.select()
                .from(masterMixRecipes)
                .where(eq(masterMixRecipes.mastermixId, mastermix.id))
                .orderBy(masterMixRecipes.orderIndex);

            return {
                id: mastermix.id,
                orderIndex: mastermix.orderIndex,
                nameOfMasterMix: mastermix.nameOfMastermix,
                recipes: recipes.map(recipe => ({
                    id: recipe.id,
                    orderIndex: recipe.orderIndex,
                    finalSource: recipe.finalSource,
                    unit: recipe.unit,
                    finalConcentration: recipe.finalConcentration,
                    tipWashing: recipe.tipWashing,
                    stockConcentration: recipe.stockConcentration,
                    liquidType: recipe.liquidType,
                    dispenseType: recipe.dispenseType
                }))
            };
        }));

        const experimentData = {
            ...experiment[0].experiment,
            masterMixes: masterMixesWithRecipes,
            ownerFullName: experiment[0].owner?.fullname || 'Owner not found'
        };

        res.json(experimentData);
    } catch (error: any) {
        console.error('Get experiment error:', error);
        res.status(500).json({ message: 'Failed to fetch experiment', error: error.message });
    }
});

// Create new experiment
router.post('/', authenticateToken, async (req: Request, res: Response) => {
    try {
        const {
            nameOfExperimentalPlan,
            numOfSampleConcentrations,
            numOfTechnicalReplicates,
            mastermixVolumePerReaction,
            sampleVolumePerReaction,
            pcrPlateSize
        } = req.body;

        const newExperiment = await db.insert(experimentalPlans)
            .values({
                nameOfExperimentalPlan,
                numOfSampleConcentrations,
                numOfTechnicalReplicates,
                mastermixVolumePerReaction,
                sampleVolumePerReaction,
                pcrPlateSize,
                ownerId: req.user!.id
            })
            .returning();

        res.status(201).json(newExperiment[0]);
    } catch (error: any) {
        console.error('Create experiment error:', error);
        res.status(500).json({ message: 'Failed to create experiment', error: error.message });
    }
});

// Add mastermix to experiment
router.post('/:experimentId/mastermixes', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { experimentId } = req.params;
        const { nameOfMasterMix, recipes } = req.body;

        // Get current max order index
        const maxOrderIndex = await db.select()
            .from(masterMixes)
            .where(eq(masterMixes.experimentalPlanId, experimentId))
            .max(masterMixes.orderIndex);

        const newOrderIndex = (maxOrderIndex[0].max || 0) + 1;

        // Create mastermix
        const newMastermix = await db.insert(masterMixes)
            .values({
                experimentalPlanId: experimentId,
                nameOfMastermix: nameOfMasterMix,
                orderIndex: newOrderIndex
            })
            .returning();

        // Add recipes
        if (recipes && recipes.length > 0) {
            for (let i = 0; i < recipes.length; i++) {
                const recipe = recipes[i];
                await db.insert(masterMixRecipes)
                    .values({
                        mastermixId: newMastermix[0].id,
                        orderIndex: i + 1,
                        finalSource: recipe.finalSource,
                        unit: recipe.unit,
                        finalConcentration: recipe.finalConcentration,
                        tipWashing: recipe.tipWashing,
                        stockConcentration: recipe.stockConcentration,
                        liquidType: recipe.liquidType,
                        dispenseType: recipe.dispenseType
                    });
            }
        }

        res.status(201).json(newMastermix[0]);
    } catch (error: any) {
        console.error('Add mastermix error:', error);
        res.status(500).json({ message: 'Failed to add mastermix', error: error.message });
    }
});

// Update experiment
router.put('/:experimentId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { experimentId } = req.params;
        const {
            nameOfExperimentalPlan,
            numOfSampleConcentrations,
            numOfTechnicalReplicates,
            mastermixVolumePerReaction,
            sampleVolumePerReaction,
            pcrPlateSize
        } = req.body;

        const updatedExperiment = await db.update(experimentalPlans)
            .set({
                nameOfExperimentalPlan,
                numOfSampleConcentrations,
                numOfTechnicalReplicates,
                mastermixVolumePerReaction,
                sampleVolumePerReaction,
                pcrPlateSize,
                updatedAt: new Date()
            })
            .where(eq(experimentalPlans.id, experimentId))
            .returning();

        if (updatedExperiment.length === 0) {
            return res.status(404).json({ message: 'Experiment not found' });
        }

        res.json(updatedExperiment[0]);
    } catch (error: any) {
        console.error('Update experiment error:', error);
        res.status(500).json({ message: 'Failed to update experiment', error: error.message });
    }
});

// Update mastermix
router.put('/mastermixes/:mastermixId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { mastermixId } = req.params;
        const { nameOfMasterMix, recipes } = req.body;

        const updatedMastermix = await db.update(masterMixes)
            .set({
                nameOfMastermix,
                updatedAt: new Date()
            })
            .where(eq(masterMixes.id, mastermixId))
            .returning();

        if (updatedMastermix.length === 0) {
            return res.status(404).json({ message: 'Mastermix not found' });
        }

        // Update recipes if provided
        if (recipes && recipes.length > 0) {
            // Delete existing recipes
            await db.delete(masterMixRecipes)
                .where(eq(masterMixRecipes.mastermixId, mastermixId));

            // Add new recipes
            for (let i = 0; i < recipes.length; i++) {
                const recipe = recipes[i];
                await db.insert(masterMixRecipes)
                    .values({
                        mastermixId,
                        orderIndex: i + 1,
                        finalSource: recipe.finalSource,
                        unit: recipe.unit,
                        finalConcentration: recipe.finalConcentration,
                        tipWashing: recipe.tipWashing,
                        stockConcentration: recipe.stockConcentration,
                        liquidType: recipe.liquidType,
                        dispenseType: recipe.dispenseType
                    });
            }
        }

        res.json(updatedMastermix[0]);
    } catch (error: any) {
        console.error('Update mastermix error:', error);
        res.status(500).json({ message: 'Failed to update mastermix', error: error.message });
    }
});

export default router;
