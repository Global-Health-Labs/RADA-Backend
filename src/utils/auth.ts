import * as bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import crypto from "crypto";

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const findUserByEmail = async (email: string) => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return user;
};

export const generateTemporaryPassword = (length = 12) => {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";

  // Ensure at least one of each required character type
  password += charset.match(/[a-z]/)![0]; // lowercase
  password += charset.match(/[A-Z]/)![0]; // uppercase
  password += charset.match(/[0-9]/)![0]; // number
  password += charset.match(/[!@#$%^&*]/)![0]; // special char

  // Fill the rest randomly
  const randomBytes = new Uint8Array(length - password.length);
  crypto.getRandomValues(randomBytes);

  for (let i = 0; i < length - password.length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");
};
