import { Router, Request, Response } from 'express';
import { db } from '../db';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get users with roles
router.get('/roles', authenticateToken, async (req: Request, res: Response) => {
    try {
        const users = await db.query(
            `SELECT 
                u.id as user_id,
                u.fullname,
                u.email,
                r.name as role,
                u.role_updated_at
            FROM users u
            JOIN roles r ON u.role_id = r.id`
        );

        res.json(users.rows);
    } catch (error) {
        console.error('Get users with roles error:', error);
        res.status(500).json({ message: 'Failed to fetch users', error: error.message });
    }
});

// Update user role
router.patch('/:userId/role', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { newRole } = req.body;

        // Get user and current role
        const user = await db.query(
            `SELECT u.*, r.name as role_name 
            FROM users u 
            JOIN roles r ON u.role_id = r.id 
            WHERE u.id = $1`,
            [userId]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const currentRole = user.rows[0].role_name;

        // Get new role ID
        const role = await db.query(
            'SELECT id FROM roles WHERE name = $1',
            [newRole]
        );

        if (role.rows.length === 0) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        // Check if the role is actually changing
        if (currentRole === newRole) {
            return res.status(400).json({ message: 'User already has this role' });
        }

        // Update user's role
        const updatedUser = await db.query(
            `UPDATE users 
            SET role_id = $1, role_updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2
            RETURNING *`,
            [role.rows[0].id, userId]
        );

        res.json({
            message: 'Role updated successfully',
            user: updatedUser.rows[0]
        });
    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({ message: 'Failed to update user role', error: error.message });
    }
});

export default router;
