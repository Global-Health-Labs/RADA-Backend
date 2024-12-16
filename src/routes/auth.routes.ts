import { eq } from "drizzle-orm";
import { Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import config from "../config";
import { db } from "../db";
import { roles, users } from "../db/schema";
import { authenticateToken } from "../middleware/auth";
import { sendResetPasswordEmail } from "../services/email.service";
import { comparePassword, hashPassword } from "../utils/auth";

const router = Router();

// Login endpoint
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    console.log(email, password);

    // Find user
    const [userWithRole] = await db
      .select()
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.email, email))
      .limit(1);

    const { user, role } = userWithRole;

    if (!user || !role) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check if user is disabled
    if (user.status === "disabled") {
      return res.status(403).json({
        message: "Account is disabled. Please contact the administrator.",
      });
    }

    // Check password
    const validPassword = await comparePassword(password, user.password!);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate appropriate token based on confirmation status
    let token;
    if (!user.confirmed) {
      token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          type: "password_reset",
        },
        config.JWT_SECRET_KEY,
        { expiresIn: "1h" }
      );
    } else {
      token = jwt.sign(
        {
          id: user.id,
          username: user.fullname,
          role: role.name,
        },
        config.JWT_SECRET_KEY,
        { expiresIn: config.JWT_ACCESS_TOKEN_EXPIRES }
      );
    }

    res.json({
      access_token: token,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        role: role.name,
        confirmed: user.confirmed,
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

// Forgot password endpoint
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status === "disabled") {
      return res.status(403).json({
        message: "Account is disabled. Please contact the administrator.",
      });
    }

    // Generate reset token valid for 1 hour
    const resetToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        type: "password_reset",
      },
      config.JWT_SECRET_KEY,
      { expiresIn: "1h" }
    );

    // Send reset email
    const resetLink = `${config.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await sendResetPasswordEmail(email, resetLink);

    res.json({
      message: "If the email exists, reset instructions will be sent.",
    });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      message: "Failed to process request",
      error: error.message,
    });
  }
});

// Reset password endpoint
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        message: "Token and password are required",
      });
    }

    // Verify and decode the reset token
    let decoded;
    try {
      decoded = jwt.verify(token, config.JWT_SECRET_KEY) as {
        id: string;
        email: string;
        type: string;
      };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return res.status(400).json({ message: "Reset token has expired" });
      }
      return res.status(400).json({ message: "Invalid reset token" });
    }

    // Verify this is a password reset token
    if (decoded.type !== "password_reset") {
      return res.status(400).json({ message: "Invalid token type" });
    }

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Verify email matches
    if (user.email !== decoded.email) {
      return res.status(400).json({ message: "Invalid token" });
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update user password
    await db
      .update(users)
      .set({
        password: hashedPassword,
        confirmed: true,
      })
      .where(eq(users.id, user.id));

    res.json({ message: "Password successfully reset" });
  } catch (error: any) {
    console.error("Reset password error:", error);
    res.status(500).json({
      message: "Failed to reset password",
      error: error.message,
    });
  }
});

export default router;
