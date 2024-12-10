import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, roles } from '../db/schema';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get users with roles
router.get('/roles', authenticateToken, async (req: Request, res: Response) => {
    try {
        const usersWithRoles = await db
            .select({
                user_id: users.id,
                fullname: users.fullname,
                email: users.email,
                role: roles.name,
                role_updated_at: users.roleUpdatedAt
            })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id));

        res.json(usersWithRoles);
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
        const [userWithRole] = await db
            .select({
                user: users,
                role_name: roles.name
            })
            .from(users)
            .leftJoin(roles, eq(users.roleId, roles.id))
            .where(eq(users.id, userId))
            .limit(1);

        if (!userWithRole) {
            return res.status(404).json({ message: 'User not found' });
        }

        const currentRole = userWithRole.role_name;

        // Get new role ID
        const [role] = await db
            .select()
            .from(roles)
            .where(eq(roles.name, newRole))
            .limit(1);

        if (!role) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        // Check if the role is actually changing
        if (currentRole === newRole) {
            return res.status(400).json({ message: 'User already has this role' });
        }

        // Update user's role
        const [updatedUser] = await db
            .update(users)
            .set({
                roleId: role.id,
                roleUpdatedAt: new Date()
            })
            .where(eq(users.id, userId))
            .returning();

        res.json({
            message: 'Role updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({ message: 'Failed to update user role', error: error.message });
    }
});

export default router;
