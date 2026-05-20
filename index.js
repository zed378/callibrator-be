require("./src/utils/env");

// debugging
process.on("uncaughtException", console.error);

process.on("unhandledRejection", console.error);

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

const storagePath = require("./src/utils/storagePath");

// ======================================================
// INITIALIZATION
// ======================================================

// Ensure required folders exist
ensureFolderExisted();

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

console.log("Allowed CORS origins:", allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server / Postman requests (no origin header)
      if (!origin) {
        return callback(null, true);
      }

      // Allow all if no CORS_ORIGIN specified (development)
      if (allowedOrigins.length === 0 || allowedOrigins.includes("*")) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin.trim())) {
        return callback(null, true);
      }

      // Log the mismatch for debugging
      console.warn(
        `CORS error: "${origin}" not in allowed origins:`,
        allowedOrigins,
      );

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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Default: 500 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "Error",
    message: "Too many requests, please try again later",
  },
});

// Strict rate limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per 15 minutes (prevents brute force)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "Error",
    message: "Too many authentication attempts, please try again later",
  },
});

// Strict rate limiter for OTP/Password reset endpoints
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour
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

app.use("/uploads", express.static(storagePath("uploads")));

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
const permissionRoutes = require("./src/routes/api/permission");
const tenantRoutes = require("./src/routes/api/tenant");
const tenantBackupRoutes = require("./src/routes/api/tenantBackup");
const tablePermissionRoutes = require("./src/routes/api/tablePermission");

// ======================================================
// ROUTES ENDPOINT
// ======================================================

if (process.env.NODE_ENV !== "production") {
  app.use("/api/v1/migration", migrationRoutes);
}
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/permissions", permissionRoutes);
app.use("/api/v1/tenants", tenantRoutes);
app.use("/api/v1/tenants", tenantBackupRoutes);
app.use("/api/v1/table-permissions", tablePermissionRoutes);

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

app.get("/documentation", (req, res) => {
  return res.sendFile(htmlDocPath);
});

app.get("/standards", (req, res) => {
  return res.sendFile(codingStandardsPath);
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

    // Redis Connection
    await initRedis();

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
    console.error("Failed to start server:", error.message);

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
