/**
 * Application Constants
 *
 * Centralized application-wide constants including pagination, OTP, password,
 * session, backup, rate limiting, and HTTP settings.
 */

// =============================================================================
// HTTP STATUS CODES
// =============================================================================
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// =============================================================================
// DEFAULT PAGINATION SETTINGS
// =============================================================================
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

// =============================================================================
// USER STATUS VALUES
// =============================================================================
const USER_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  SUSPENDED: "SUSPENDED",
};

// =============================================================================
// OTP SETTINGS
// =============================================================================
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_REQUESTS = 3;
const OTP_REQUEST_WINDOW_MINUTES = 15;

// =============================================================================
// PASSWORD SETTINGS
// =============================================================================
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_SALT_ROUNDS = 12;

// =============================================================================
// SESSION SETTINGS
// =============================================================================
const DEFAULT_SESSION_EXPIRY_HOURS = 24;
const MAX_SESSIONS_PER_USER = 5;

// =============================================================================
// BACKUP SETTINGS
// =============================================================================
const DEFAULT_BACKUP_RETENTION_DAYS = 90;
const MAX_BACKUP_RETENTION_DAYS = 3650;
const BACKUP_DIR = "backups";

// =============================================================================
// RATE LIMITING (milliseconds)
// =============================================================================
const RATE_LIMIT = {
  // 15 minutes
  STANDARD_WINDOW: 15 * 60 * 1000,
  // 1 hour
  HOUR_WINDOW: 60 * 60 * 1000,
  // 24 hours
  DAY_WINDOW: 24 * 60 * 60 * 1000,
  // 1 minute
  SHORT_WINDOW: 1 * 60 * 1000,
  // 5 minutes
  FIVE_MINUTES: 5 * 60 * 1000,
};

// =============================================================================
// RATE LIMITER CONFIGURATION
// =============================================================================
const RATE_LIMITER_CONFIG = {
  // Login: 5 attempts per 15 minutes, lockout 15 minutes
  LOGIN: {
    maxAttempts: 5,
    windowMs: RATE_LIMIT.STANDARD_WINDOW,
    lockoutMs: RATE_LIMIT.STANDARD_WINDOW,
    description: "Login endpoint",
  },
  // Forgot password (OTP): 3 attempts per 15 minutes, lockout 15 minutes
  FORGOT_PASSWORD: {
    maxAttempts: 3,
    windowMs: RATE_LIMIT.STANDARD_WINDOW,
    lockoutMs: RATE_LIMIT.STANDARD_WINDOW,
    description: "Forgot password (OTP request)",
  },
  // Registration: 3 attempts per 1 hour, lockout 1 hour
  REGISTRATION: {
    maxAttempts: 3,
    windowMs: RATE_LIMIT.HOUR_WINDOW,
    lockoutMs: RATE_LIMIT.HOUR_WINDOW,
    description: "Registration",
  },
  // Refresh token: 10 attempts per 15 minutes, lockout 5 minutes
  REFRESH_TOKEN: {
    maxAttempts: 10,
    windowMs: RATE_LIMIT.STANDARD_WINDOW,
    lockoutMs: RATE_LIMIT.FIVE_MINUTES,
    description: "Token refresh",
  },
  // Unauthenticated endpoints default
  UNCLASSIFIED: {
    maxAttempts: 5,
    windowMs: RATE_LIMIT.STANDARD_WINDOW,
    lockoutMs: RATE_LIMIT.FIVE_MINUTES,
    description: "Default for unclassified endpoints",
  },
};

// =============================================================================
// RATE LIMITER CACHING (milliseconds)
// =============================================================================
const RATE_LIMITER_CACHE = {
  FAILED_ATTEMPT: RATE_LIMIT.STANDARD_WINDOW, // 15 minutes
  LOCKOUT: RATE_LIMIT.STANDARD_WINDOW, // 15 minutes
  TOKEN_BLOCK: RATE_LIMIT.DAY_WINDOW, // 24 hours
  ENDPOINT_RATE: RATE_LIMIT.SHORT_WINDOW, // 1 minute
};

// =============================================================================
// FILE UPLOAD SETTINGS
// =============================================================================
const FILE_UPLOAD = {
  // 5MB default
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  // 2MB for avatars
  AVATAR_MAX_FILE_SIZE: 2 * 1024 * 1024,
  ALLOWED_AVATAR_MIMES: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  ALLOWED_AVATAR_EXTENSIONS: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  ALLOWED_LOGO_MIMES: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ],
  ALLOWED_LOGO_EXTENSIONS: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
};

// =============================================================================
// REDIS LOCK & CACHE TTL (milliseconds)
// =============================================================================
const REDIS = {
  // 5 seconds default lock TTL
  DEFAULT_LOCK_TTL: 5000,
  // Cache TTL values (milliseconds)
  CACHE_TTL: {
    SHORT: 60 * 1000, // 1 minute
    MEDIUM: 5 * 60 * 1000, // 5 minutes
    LONG: 15 * 60 * 1000, // 15 minutes
    HOUR: 60 * 60 * 1000, // 1 hour
    DAY: 24 * 60 * 60 * 1000, // 24 hours
  },
};

// =============================================================================
// DATE/TIME CONSTANTS (milliseconds)
// =============================================================================
const TIME = {
  SECONDS: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  // 7 days (refresh token expiry)
  WEEK: 7 * 24 * 60 * 60 * 1000,
  // 15 minutes (account lockout)
  FIFTEEN_MINUTES: 15 * 60 * 1000,
};

// =============================================================================
// EXPORTED CONSTANTS
// =============================================================================
module.exports = {
  // HTTP Status codes
  HTTP_STATUS,

  // Pagination
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,

  // User
  USER_STATUS,

  // OTP
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_REQUESTS,
  OTP_REQUEST_WINDOW_MINUTES,

  // Password
  PASSWORD_MIN_LENGTH,
  PASSWORD_SALT_ROUNDS,

  // Session
  DEFAULT_SESSION_EXPIRY_HOURS,
  MAX_SESSIONS_PER_USER,

  // Backup
  DEFAULT_BACKUP_RETENTION_DAYS,
  MAX_BACKUP_RETENTION_DAYS,
  BACKUP_DIR,

  // Rate limiting
  RATE_LIMIT,
  RATE_LIMITER_CONFIG,
  RATE_LIMITER_CACHE,

  // File upload
  FILE_UPLOAD,

  // Redis
  REDIS,

  // Time
  TIME,
};
