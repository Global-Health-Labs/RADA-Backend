import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import config from "../config";
import fs from "fs";

const sslCert = config.db.useSSL
  ? fs.readFileSync("./db-ssl-certificate.pem").toString()
  : undefined;

const pool = new Pool({
  connectionString: config.db.url,
  connectionTimeoutMillis: 20000,
  idleTimeoutMillis: 5000,
  max: 60,
  ssl: config.db.useSSL
    ? {
        ca: sslCert, // Use the AWS RDS CA certificate
      }
    : undefined,
});

export const db = drizzle(pool, { schema });
