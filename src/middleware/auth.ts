import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import config from "../config";
import { db } from "../db";
import { users, roles } from "../db/schema";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        fullName: string;
        role: string;
        confirmed: boolean;
        email: string;
      };
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET_KEY) as {
      id: string;
      username: string;
      role: string;
    };

    // Get user from database to ensure they still exist and have proper permissions
    const [userWithRole] = await db
      .select()
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (!userWithRole || !userWithRole.role) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    // Check if user is disabled
    if (userWithRole.user.status === "disabled") {
      return res
        .status(403)
        .json({
          message: "Account is disabled. Please contact the administrator.",
        });
    }

    const { user, role } = userWithRole;

    // Attach user to request object
    req.user = {
      id: user.id,
      fullName: user.fullname,
      role: role.name,
      confirmed: user.confirmed,
      email: user.email,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid token" });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Token expired" });
    }
    console.error("Auth middleware error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Middleware to check if user has required role
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
};

// Middleware to check if user is an admin
export const requireAdmin = requireRole(["admin"]);
