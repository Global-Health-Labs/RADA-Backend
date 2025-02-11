import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import config from "../config";
import fs from "fs";

const sslCert = config.db.useSSL
  ? fs.readFileSync("./db-ssl-certificate.pem").toString()
  : undefined;

console.log(config.DATABASE_URL);

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.db.useSSL
    ? {
        rejectUnauthorized: true, // Enforce SSL validation
        ca: sslCert, // Use the AWS RDS CA certificate
      }
    : false,
});

export const db = drizzle(pool, { schema });
