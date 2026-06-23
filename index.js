require("./src/utils/env");
const express = require("express");

const compression = require("compression");
const crypto = require("crypto");
const timeout = require("connect-timeout");
const hpp = require("hpp");

const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { swaggerDocs } = require("./src/docs/swagger");
const path = require("path");

const { Connection, db } = require("./src/config");

const { globalSanitizer } = require("./src/middlewares/globalSanitizer");

const { ensureFolderExisted } = require("./src/middlewares/createFolder");

const { notFound } = require("./src/middlewares/notFound");

const { errorHandler } = require("./src/middlewares/errorHandlers");

const { cronBackup } = require("./src/middlewares/backup");

const { initSessionCleanup } = require("./src/middlewares/sessionCleanup");

const { initRedis, closeRedis } = require("./src/services/redis.service");

const {
  processEmailQueue,
  closeRabbitMQ,
} = require("./src/services/emailQueue.service");

const { accessLog } = require("./src/middlewares/accessLog");

const { activityLogger, logger } = require("./src/middlewares/activityLog");

const { RATE_LIMIT } = require("./src/constants/appConstants");

const storagePath = require("./src/utils/storagePath");

const migrationService = require("./src/services/migration.service");

// ======================================================
// INITIALIZATION
// ======================================================

// Ensure required folders exist
ensureFolderExisted();

// Error handlers - must be after logger import
process.on("uncaughtException", (err) => {
  logger?.error(`uncaughtException: ${err.stack || err.message}`, err) ??
    console.error(err);
});

process.on("unhandledRejection", (reason) => {
  logger?.error(
    `unhandledRejection: ${reason?.stack || JSON.stringify(reason)}`,
  ) ?? console.error(reason);
});

// Initialize Express
const app = express();

// ======================================================
// GLOBAL SETTINGS
// ======================================================

// Trust Proxy
// Required for:
// - Kubernetes
// - Nginx
// - Cloudflare
// - Rate limiter
app.set("trust proxy", 1);

// Pretty JSON in development
if (process.env.NODE_ENV !== "production") {
  app.set("json spaces", 2);
}

// ======================================================
// MIDDLEWARES
// ======================================================

// Compression
app.use(compression());

// HTTPS Redirect (production only — behind reverse proxy)
if (
  process.env.NODE_ENV === "production" &&
  process.env.FORCE_HTTPS === "true"
) {
  app.use((req, res, next) => {
    if (!req.secure && req.get("X-Forwarded-Proto") !== "https") {
      // Redirect to HTTPS (preserves path + query)
      return res.redirect(301, `https://${req.get("Host")}${req.url}`);
    }
    next();
  });
}

// Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// Prevent HTTP Parameter Pollution
app.use(hpp());

// ======================================================
// CORS
// ======================================================

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server / Postman requests (no origin header)
      if (!origin) {
        return callback(null, true);
      }

      // Strict: only allow explicitly configured origins
      if (
        allowedOrigins.includes(origin.trim()) ||
        allowedOrigins.includes("*")
      ) {
        return callback(null, true);
      }

      // Production default: reject if no origins configured
      if (
        process.env.NODE_ENV === "production" &&
        allowedOrigins.length === 0
      ) {
        console.warn(
          `CORS error: "${origin}" rejected — no CORS_ORIGIN configured in production`,
        );
        return callback(new Error("Not allowed by CORS"));
      }

      // Development default: allow all
      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,
    exposedHeaders: ["X-Request-Id"],
    optionsSuccessStatus: 200,
  }),
);

// ======================================================
// RATE LIMITERS
// ======================================================

// Default rate limiter (applied to all routes)
const defaultLimiter = rateLimit({
  windowMs: RATE_LIMIT.STANDARD_WINDOW,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "Error",
    message: "Too many requests, please try again later",
  },
});

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT.STANDARD_WINDOW,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "Error",
    message: "Too many authentication attempts, please try again later",
  },
});

// Strict rate limiter for OTP/Password reset endpoints
const otpLimiter = rateLimit({
  windowMs: RATE_LIMIT.HOUR_WINDOW,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "Error",
    message: "Too many requests, please try again later",
  },
});

// Apply default limiter globally
app.use(defaultLimiter);

// ======================================================
// BODY PARSER
// ======================================================

app.use(
  express.json({
    limit: "10mb",
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  }),
);

// ======================================================
// REQUEST TIMEOUT
// ======================================================

app.use(timeout("30s"));

app.use((req, res, next) => {
  if (!req.timedout) {
    next();
  }
});

app.use((err, req, res, next) => {
  if (err.timeout) {
    return res.status(408).json({
      status: "Error",
      message: "Request timeout",
    });
  }

  next(err);
});

// ======================================================
// REQUEST ID
// ======================================================

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();

  res.setHeader("X-Request-Id", req.requestId);

  next();
});

// ======================================================
// LOGGING
// ======================================================

app.use(accessLog);

app.use(activityLogger);

// ======================================================
// STATIC FILES
// ======================================================

app.use("/.well-known", express.static(".well-known"));

app.use("/uploads", express.static(storagePath("uploads")));

app.use("/public", express.static("public"));

// ======================================================
// SANITIZER
// ======================================================

app.use(globalSanitizer);

// ======================================================
// SWAGGER
// ======================================================

swaggerDocs(app);

// ======================================================
// ROUTES
// ======================================================
const migrationRoutes = require("./src/routes/internal/migration");
const authRoutes = require("./src/routes/api/auth");
const userRoutes = require("./src/routes/api/user");
const tenantRoutes = require("./src/routes/api/tenant");
const tenantBackupRoutes = require("./src/routes/api/tenantBackup");
const rolesRoutes = require("./src/routes/api/roles");
const sessionRoutes = require("./src/routes/api/session");
const warehouseRoutes = require("./src/routes/api/warehouse");
const stockRoutes = require("./src/routes/api/stock");
const calibrationDevicesRoutes = require("./src/routes/api/calibrationDevices");
const calibrationRecordsRoutes = require("./src/routes/api/calibrationRecords");
const certificateRoutes = require("./src/routes/api/certificates");

// ======================================================
// ROUTES ENDPOINT
// ======================================================

if (process.env.NODE_ENV !== "production") {
  app.use("/api/v1/migration", migrationRoutes);
}
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/roles", rolesRoutes);
app.use("/api/v1/tenants", tenantRoutes);
app.use("/api/v1/tenants", tenantBackupRoutes);
app.use("/api/v1/sessions", sessionRoutes);
app.use("/api/v1/warehouses", warehouseRoutes);
app.use("/api/v1/stocks", stockRoutes);
app.use("/api/v1/calibration-devices", calibrationDevicesRoutes);
app.use("/api/v1/calibration-records", calibrationRecordsRoutes);
app.use("/api/v1/certificates", certificateRoutes);

// ======================================================
// HEALTHCHECK
// ======================================================

app.get("/health", async (req, res) => {
  try {
    await db.authenticate();

    return res.status(200).json({
      status: "OK",
      uptime: process.uptime(),
      timestamp: new Date(),
      memory: process.memoryUsage(),
      pid: process.pid,
      node: process.version,
      database: "connected",
    });
  } catch (error) {
    return res.status(503).json({
      status: "ERROR",
      database: "disconnected",
      message: error.message,
    });
  }
});

// ======================================================
// ROOT
// ======================================================

app.get("/", (req, res) => {
  return res.status(200).json({
    status: "Success",
    message: "Your API is running",
  });
});

// ======================================================
// LIVENESS
// ======================================================

app.get("/live", (req, res) => {
  return res.status(200).send("OK");
});

// ======================================================
// READINESS
// ======================================================

app.get("/ready", async (req, res) => {
  try {
    await db.authenticate();

    return res.status(200).send("READY");
  } catch {
    return res.status(503).send("NOT READY");
  }
});

// ======================================================
// DOCUMENTATION (HTML)
// ======================================================

const htmlDocPath = path.join(__dirname, "docs", "DOCUMENTATION.html");
const codingStandardsPath = path.join(
  __dirname,
  "docs",
  "CODING_STANDARDS.html",
);
const tablePermissionsDocPath = path.join(
  __dirname,
  "docs",
  "TABLE_PERMISSIONS.html",
);

app.get("/documentation", (req, res) => {
  return res.sendFile(htmlDocPath);
});

app.get("/standards", (req, res) => {
  return res.sendFile(codingStandardsPath);
});

app.get("/tab-permissions", (req, res) => {
  return res.sendFile(tablePermissionsDocPath);
});

// ======================================================
// TEST ERROR ROUTE
// ======================================================

app.get("/error", (req, res, next) => {
  const err = new Error("This is a test error");

  err.status = 500;

  next(err);
});

// ======================================================
// NOT FOUND
// ======================================================

app.use(notFound);

// ======================================================
// ERROR HANDLER
// ======================================================

app.use(errorHandler);

// ======================================================
// START SERVER
// ======================================================

let server;

async function startServer() {
  try {
    // Database Connection
    await Connection();

    // Ensure ALL tables exist before seeding.
    // Use alter mode to safely sync model definitions with the database
    // (adds new columns/tables without dropping existing data).
    await db.sync({ alter: true });
    logger.info("All database tables synced (mode: alter)");

    // Redis Connection
    await initRedis();

    // Seed Database (Roles, Menu Groups, Permissions, and Default Users)
    try {
      await migrationService.seedAll();
      logger.info("Database seeded successfully on startup");
    } catch (seedError) {
      logger.error(`Failed to seed database on startup: ${seedError.message}`);
      // Don't fail startup if seeding fails
    }

    // Start Cron Jobs
    cronBackup();
    initSessionCleanup();

    // Start Email Queue Worker (background processing)
    await processEmailQueue();

    const port = process.env.PORT || 3000;

    server = app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);

    process.exit(1);
  }
}

startServer();

// ======================================================
// GRACEFUL SHUTDOWN
// ======================================================

async function shutdown(signal) {
  try {
    logger.info(`${signal} received. Shutting down application...`);

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) {
            return reject(err);
          }

          logger.info("HTTP server closed");

          resolve();
        });
      });
    }

    await db.close();

    logger.info("Database connection closed.");

    await closeRedis();

    logger.info("Redis connection closed.");

    await closeRabbitMQ();

    logger.info("RabbitMQ connection closed.");

    process.exit(0);
  } catch (error) {
    logger.error(`Shutdown error: ${error.message}`);

    process.exit(1);
  }
}

// ======================================================
// PROCESS HANDLERS
// ======================================================

process.on("SIGINT", () => shutdown("SIGINT"));

process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("uncaughtException", async (err) => {
  logger.error(`uncaughtException: ${err.stack || err.message}`);

  await shutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", async (reason) => {
  logger.error(
    `unhandledRejection: ${reason?.stack || JSON.stringify(reason)}`,
  );

  await shutdown("UNHANDLED_REJECTION");
});
