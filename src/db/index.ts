import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import config from "../config";
import fs from "fs";

const sslCert = config.db.useSSL
  ? fs.readFileSync("./db-ssl-certificate.pem").toString()
  : undefined;

console.log("Database URL:", config.DATABASE_URL);
console.log("SSL Enabled:", config.db.useSSL, sslCert);

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.db.useSSL
    ? {
        rejectUnauthorized: false, // Enforce SSL validation
        ca: sslCert, // Use the AWS RDS CA certificate
        checkServerIdentity: (host, cert) => {
          console.log("Certificate check:", host, cert);
          // Allow connections to RDS instances
          const rdsHosts = [
            "rada-v2-db-staging.czcucs4e691z.us-east-2.rds.amazonaws.com",
            "*.us-east-2.rds.amazonaws.com",
            "*.rds.amazonaws.com",
          ];
          if (
            rdsHosts.some(
              (h) =>
                h === host || (h.startsWith("*.") && host.endsWith(h.slice(1)))
            )
          ) {
            return undefined;
          }
          return new Error(`Certificate not valid for ${host}`);
        },
      }
    : false,
});

export const db = drizzle(pool, { schema });
