import { eq } from "drizzle-orm";
import { Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import config from "../config";
import { db } from "../db";
import { roles, users } from "../db/schema";
import { authenticateToken } from "../middleware/auth";
import { comparePassword, hashPassword } from "../utils/auth";

const router = Router();

// Login endpoint
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const [userWithRole] = await db
      .select()
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.email, email))
      .limit(1);

    if (!userWithRole || !userWithRole.role) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check password
    const validPassword = await comparePassword(
      password,
      userWithRole.user.password!
    );
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate token
    const token = jwt.sign(
      {
        id: userWithRole.user.id,
        username: userWithRole.user.fullname,
        role: userWithRole.role.name,
      },
      config.JWT_SECRET_KEY,
      { expiresIn: config.JWT_ACCESS_TOKEN_EXPIRES }
    );

    res.json({
      access_token: token,
      user: {
        id: userWithRole.user.id,
        fullname: userWithRole.user.fullname,
        email: userWithRole.user.email,
        role: userWithRole.role.name,
        confirmed: userWithRole.user.confirmed,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
});

// Profile endpoint
router.get(
  "/profile",
  authenticateToken,
  async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    res.json({
      user: {
        id: req.user.id,
        fullName: req.user.fullName,
        email: req.user.email,
        role: req.user.role,
        confirmed: req.user.confirmed,
      },
    });
  }
);

// Register endpoint
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { fullname, email, password } = req.body;

    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Get default role (user)
    const [userRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, "user"))
      .limit(1);

    if (!userRole) {
      return res.status(500).json({ message: "Default role not found" });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        fullname,
        email,
        password: hashedPassword,
        roleId: userRole.id,
        confirmed: false,
      })
      .returning();

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: newUser.id,
        fullname: newUser.fullname,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res
      .status(500)
      .json({ message: "Registration failed", error: error.message });
  }
});

export default router;
