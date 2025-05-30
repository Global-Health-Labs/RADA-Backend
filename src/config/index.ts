import * as dotenv from "dotenv";
import { z } from "zod";
import path from "path";
import fs from "fs";

// Force reload environment variables
const envPath = path.join(process.cwd(), ".env");
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string(),
  DB_USE_SSL: z.string(),

  // JWT
  JWT_SECRET_KEY: z.string(),
  JWT_ACCESS_TOKEN_EXPIRES: z.string(),

  // AWS
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_REGION: z.string(),
  DOCUMENTS_BUCKET_NAME: z.string(),

  // Environment
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  PORT: z.coerce.number().optional().default(8080),

  // Domain Configuration
  DOMAIN_NAME: z.string(),
  FRONTEND_SUBDOMAIN: z.string(),
  CLOUDFRONT_DOMAIN_NAME: z.string(),
  USE_HTTPS: z.string().optional(),

  // SMTP Configuration
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number(),
  SMTP_SECURE: z.enum(["true", "false"]).transform((value) => value === "true"),
  SMTP_USER: z.string(),
  SMTP_PASS: z.string(),
  SMTP_FROM: z.string(),

  // Frontend URL
  FRONTEND_URL: z.string(),
});

// Parse environment variables
const parsedEnv = envSchema.parse(process.env);

const config = {
  ...parsedEnv,
  PORT: process.env.PORT ? Number(process.env.PORT) : parsedEnv.PORT,
  db: {
    url: parsedEnv.DATABASE_URL,
    useSSL: parsedEnv.DB_USE_SSL?.trim()?.toLowerCase() === "true",
  },
  aws: {
    region: parsedEnv.AWS_REGION,
    accessKeyId: parsedEnv.AWS_ACCESS_KEY_ID,
    secretAccessKey: parsedEnv.AWS_SECRET_ACCESS_KEY,
    documentsBucketName: parsedEnv.DOCUMENTS_BUCKET_NAME,
  },
  smtp: {
    host: parsedEnv.SMTP_HOST,
    port: parsedEnv.SMTP_PORT,
    secure: parsedEnv.SMTP_SECURE,
    auth: {
      user: parsedEnv.SMTP_USER,
      pass: parsedEnv.SMTP_PASS,
    },
    from: parsedEnv.SMTP_FROM,
  },
  ssl: {
    enabled: parsedEnv.USE_HTTPS?.trim()?.toLowerCase() === "true",
    certPath: `/etc/letsencrypt/live/${parsedEnv.DOMAIN_NAME}`,
  },
  frontendUrl: parsedEnv.FRONTEND_URL,
};

export default config;
