import { eq } from "drizzle-orm";
import { Request, Response, Router } from "express";
import { db } from "../db";
import { roles, users } from "../db/schema";
import { authenticateToken } from "../middleware/auth";
import { sendEmail } from "../services/email.service";
import { generateInvitationEmail } from "../templates/invitation-email";
import { generateTemporaryPassword, hashPassword } from "../utils/auth";

const router = Router();

// Create new user
router.post("/", async (req: Request, res: Response) => {
  try {
    const { email, fullname, role } = req.body;

    // Check if email already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      console.log("User creation failed: Email already exists:", email);
      return res.status(400).json({ message: "Email already exists" });
    }

    // Get role ID
    const [roleRecord] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, role))
      .limit(1);

    if (!roleRecord) {
      console.log("User creation failed: Invalid role:", role);
      return res.status(400).json({ message: "Invalid role" });
    }

    console.log("Found role record:", {
      roleId: roleRecord.id,
      roleName: roleRecord.name,
    });

    // Generate temporary password
    const tempPassword = generateTemporaryPassword();

    const hashedPassword = await hashPassword(tempPassword);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        fullname,
        password: hashedPassword,
        roleId: roleRecord.id,
        confirmed: false,
      })
      .returning();

    // Generate and send invitation email
    const emailHtml = generateInvitationEmail(fullname, email, tempPassword);

    await sendEmail(email, "Welcome to RADA - Your Account Details", emailHtml);

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (error: any) {
    console.error("Create user error:", {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });
    res
      .status(500)
      .json({ message: "Failed to create user", error: error.message });
  }
});

// Get all roles
router.get("/roles", async (req: Request, res: Response) => {
  try {
    const rolesList = await db.select().from(roles);
    return res.json(rolesList);
  } catch (error) {
    console.error("Failed to fetch roles:", error);
    return res.status(500).json({ message: "Failed to fetch roles" });
  }
});

// Get users with roles
router.get("/", async (req: Request, res: Response) => {
  try {
    const usersWithRoles = await db
      .select({
        id: users.id,
        fullname: users.fullname,
        email: users.email,
        role: roles.name,
        role_updated_at: users.roleUpdatedAt,
        status: users.status,
        confirmed: users.confirmed,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id));

    res.json(usersWithRoles);
  } catch (error: any) {
    console.error("Get users with roles error:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch users", error: error.message });
  }
});

// Update user
router.put("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { fullname, role } = req.body;

    // Get user and current role
    const [userWithRole] = await db
      .select({
        user: users,
        role_name: roles.name,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (!userWithRole) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get role ID for the new role
    const [roleRecord] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, role))
      .limit(1);

    if (!roleRecord) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Update user's name and role
    await db
      .update(users)
      .set({
        fullname,
        roleId: roleRecord.id,
        roleUpdatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Get updated user data
    const [updatedUser] = await db
      .select({
        user_id: users.id,
        fullname: users.fullname,
        email: users.email,
        role: roles.name,
        confirmed: users.confirmed,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);

    res.json(updatedUser);
  } catch (error: any) {
    console.error("Update user error:", error);
    res
      .status(500)
      .json({ message: "Failed to update user", error: error.message });
  }
});

// Update user role
router.patch("/:userId/role", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { newRole } = req.body;

    // Get user and current role
    const [userWithRole] = await db
      .select({
        user: users,
        role_name: roles.name,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (!userWithRole) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentRole = userWithRole.role_name;

    // Get new role ID
    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, newRole))
      .limit(1);

    if (!role) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Check if the role is actually changing
    if (currentRole === newRole) {
      return res.status(400).json({ message: "User already has this role" });
    }

    // Update user's role
    const [updatedUser] = await db
      .update(users)
      .set({
        roleId: role.id,
        roleUpdatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    res.json({
      message: "Role updated successfully",
      user: updatedUser,
    });
  } catch (error: any) {
    console.error("Update user role error:", error);
    res
      .status(500)
      .json({ message: "Failed to update user role", error: error.message });
  }
});

// Update user status
router.put("/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "disabled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    await db.update(users).set({ status }).where(eq(users.id, id));

    res.json({ message: "User status updated successfully" });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ message: "Failed to update user status" });
  }
});

// Resend invitation
router.post("/:id/resend-invitation", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.confirmed) {
      return res.status(400).json({ message: "User is already confirmed" });
    }

    // Generate new temporary password
    const tempPassword = generateTemporaryPassword();
    const hashedPassword = await hashPassword(tempPassword);
    console.log("Temp password:", tempPassword);

    // Update user's password
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, id));

    // Generate and send invitation email
    const emailHtml = generateInvitationEmail(
      user.fullname,
      user.email,
      tempPassword
    );
    await sendEmail(
      user.email,
      "Welcome to RADA - Your Account Details",
      emailHtml
    );

    res.json({ message: "Invitation resent successfully" });
  } catch (error: any) {
    console.error("Resend invitation error:", error);
    res
      .status(500)
      .json({ message: "Failed to resend invitation", error: error.message });
  }
});

export default router;
