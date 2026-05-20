/**
 * Application Constants
 *
 * Centralized application-wide constants including pagination, OTP, password,
 * session, and backup settings.
 */

/**
 * Default pagination settings
 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

/**
 * User status values
 */
const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
};

/**
 * OTP settings
 */
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_REQUESTS = 3;
const OTP_REQUEST_WINDOW_MINUTES = 15;

/**
 * Password settings
 */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_SALT_ROUNDS = 12;

/**
 * Session settings
 */
const DEFAULT_SESSION_EXPIRY_HOURS = 24;
const MAX_SESSIONS_PER_USER = 5;

/**
 * Backup settings
 */
const DEFAULT_BACKUP_RETENTION_DAYS = 90;
const MAX_BACKUP_RETENTION_DAYS = 3650;
const BACKUP_DIR = 'backups';

module.exports = {
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  USER_STATUS,
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_REQUESTS,
  OTP_REQUEST_WINDOW_MINUTES,
  PASSWORD_MIN_LENGTH,
  PASSWORD_SALT_ROUNDS,
  DEFAULT_SESSION_EXPIRY_HOURS,
  MAX_SESSIONS_PER_USER,
  DEFAULT_BACKUP_RETENTION_DAYS,
  MAX_BACKUP_RETENTION_DAYS,
  BACKUP_DIR,
};
