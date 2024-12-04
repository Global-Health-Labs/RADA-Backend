import { Router, Request, Response } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Add or update recipes to mastermix
router.post('/:mastermixId/recipes', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { mastermixId } = req.params;
        const recipesData = Array.isArray(req.body) ? req.body : [req.body];

        // Check if mastermix exists
        const mastermix = await db.query(
            'SELECT * FROM master_mixes WHERE id = $1',
            [mastermixId]
        );

        if (mastermix.rows.length === 0) {
            return res.status(404).json({ message: 'Mastermix not found' });
        }

        // If recipes array is empty, delete the mastermix
        if (recipesData.length === 0) {
            // Get mastermix info for reordering
            const mastermixInfo = mastermix.rows[0];
            
            // Delete mastermix and its recipes
            await db.query('DELETE FROM master_mixes WHERE id = $1', [mastermixId]);

            // Reorder remaining mastermixes
            await reorderMastermixes(mastermixInfo.experimental_plan_id, mastermixInfo.order_index);

            return res.json({ message: 'Mastermix deleted' });
        }

        // Start transaction
        await db.query('BEGIN');

        try {
            // Delete existing recipes
            await db.query('DELETE FROM recipes WHERE master_mix_id = $1', [mastermixId]);

            // Add new recipes
            const processedRecipes = await Promise.all(recipesData.map(async (recipeData, index) => {
                const newRecipe = await db.query(
                    `INSERT INTO recipes 
                    (master_mix_id, final_source, unit, final_concentration, tip_washing,
                    stock_concentration, liquid_type, dispense_type, order_index)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING *`,
                    [
                        mastermixId,
                        recipeData.finalSource,
                        recipeData.unit,
                        recipeData.finalConcentration,
                        recipeData.tipWashing,
                        recipeData.stockConcentration,
                        recipeData.liquidType,
                        recipeData.dispenseType,
                        index + 1
                    ]
                );

                return newRecipe.rows[0];
            }));

            await db.query('COMMIT');

            res.status(201).json(processedRecipes);
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Add/update recipes error:', error);
        res.status(500).json({ message: 'Failed to add/update recipes', error: error.message });
    }
});

// Delete mastermix
router.delete('/:mastermixId', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { mastermixId } = req.params;

        // Get mastermix info for reordering
        const mastermix = await db.query(
            'SELECT * FROM master_mixes WHERE id = $1',
            [mastermixId]
        );

        if (mastermix.rows.length === 0) {
            return res.status(404).json({ message: 'Mastermix not found' });
        }

        const { experimental_plan_id, order_index } = mastermix.rows[0];

        // Start transaction
        await db.query('BEGIN');

        try {
            // Delete mastermix (cascade will delete its recipes)
            await db.query('DELETE FROM master_mixes WHERE id = $1', [mastermixId]);

            // Reorder remaining mastermixes
            await reorderMastermixes(experimental_plan_id, order_index);

            await db.query('COMMIT');

            res.json({ message: 'Mastermix deleted successfully' });
        } catch (error) {
            await db.query('ROLLBACK');
            throw error;
        }
    } catch (error) {
        console.error('Delete mastermix error:', error);
        res.status(500).json({ message: 'Failed to delete mastermix', error: error.message });
    }
});

// Helper function to reorder mastermixes after deletion
async function reorderMastermixes(experimentalPlanId: string, deletedOrderIndex: number): Promise<void> {
    await db.query(
        `UPDATE master_mixes 
        SET order_index = order_index - 1 
        WHERE experimental_plan_id = $1 
        AND order_index > $2`,
        [experimentalPlanId, deletedOrderIndex]
    );
}

export default router;
