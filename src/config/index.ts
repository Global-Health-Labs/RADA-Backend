import * as dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

// Force reload environment variables
const envPath = path.join(process.cwd(), '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}


const envSchema = z.object({
    // Database
    DATABASE_URL: z.string(),

    // JWT
    JWT_SECRET_KEY: z.string(),
    JWT_ACCESS_TOKEN_EXPIRES: z.string(),

    // AWS
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
    AWS_REGION: z.string(),
    BUCKET_NAME: z.string(),
    DOCUMENTS_BUCKET_NAME: z.string(),

    // Environment
    NODE_ENV: z.enum(['development', 'production']).default('development'),
    PORT: z.coerce.number().optional().default(8080),

    // Domain Configuration
    DOMAIN_NAME: z.string(),
    FRONTEND_SUBDOMAIN: z.string(),
    CLOUDFRONT_DOMAIN_NAME: z.string(),
});

// Parse environment variables
const parsedEnv = envSchema.parse(process.env);

const config = {
    ...parsedEnv,
    PORT: process.env.PORT ? Number(process.env.PORT) : parsedEnv.PORT,
    aws: {
        region: parsedEnv.AWS_REGION,
        accessKeyId: parsedEnv.AWS_ACCESS_KEY_ID,
        secretAccessKey: parsedEnv.AWS_SECRET_ACCESS_KEY,
        bucketName: parsedEnv.BUCKET_NAME,
        documentsBucketName: parsedEnv.DOCUMENTS_BUCKET_NAME
    }
};

export default config;
