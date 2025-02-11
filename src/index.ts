import express from "express";
import cors from "cors";
import config from "./config";
import { db } from "./db";
import router from "./routes";
import https from "https";
import fs from "fs";
import path from "path";

const app = express();

// Middleware
app.use(
  cors({
    origin:
      config.NODE_ENV === "production"
        ? [
            `https://${config.CLOUDFRONT_DOMAIN_NAME}`,
            `http://${config.CLOUDFRONT_DOMAIN_NAME}`,
            "http://localhost:3000",
            "https://localhost:3000",
            `https://${config.FRONTEND_SUBDOMAIN}.${config.DOMAIN_NAME}`,
            `http://${config.DOMAIN_NAME}`,
            `https://${config.DOMAIN_NAME}`,
          ]
        : true,
    credentials: true,
  })
);
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Use centralized routes
app.use("/", router);

console.log("Port: ", config.PORT, "NODE_ENV: ", config.NODE_ENV);

// Start HTTP server
app.listen(config.PORT, "0.0.0.0", () => {
  console.log(`HTTP server is running on port ${config.PORT}`);
});

// Start HTTPS server if enabled and in production
if (config.NODE_ENV === "production" && config.ssl.enabled) {
  try {
    const httpsOptions = {
      cert: fs.readFileSync(path.join(config.ssl.certPath, "fullchain.pem")),
      key: fs.readFileSync(path.join(config.ssl.certPath, "privkey.pem")),
    };

    https.createServer(httpsOptions, app).listen(8443, "0.0.0.0", () => {
      console.log("HTTPS server is running on port 8443");
    });
  } catch (error) {
    console.error("Failed to start HTTPS server:", error);
  }
}
