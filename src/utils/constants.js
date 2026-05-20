/**
 * Application Constants (Legacy)
 *
 * This file is kept for backward compatibility.
 * All constants have been moved to src/constants/ directory.
 *
 * NEW CODE should import from '../constants' instead:
 *   const { ROLE_NAMES, ROLE_IDS } = require('../constants');
 *
 * @deprecated Use src/constants/ instead
 */

const constants = require('../constants');

module.exports = {
  // Role constants
  SUPER_ADMIN_ROLE_ID: constants.SUPER_ADMIN_ROLE_ID,
  ROLE_NAMES: constants.ROLE_NAMES,
  ROLE_IDS: constants.ROLE_IDS,
  ROLE_LEVELS: constants.ROLE_LEVELS,
  BUILTIN_ROLES: constants.BUILTIN_ROLES,
  ROLE_PERMISSIONS: constants.ROLE_PERMISSIONS,

  // Permission constants (DEPRECATED)
  USER_PERMISSIONS: constants.USER_PERMISSIONS,
  TENANT_PERMISSIONS: constants.TENANT_PERMISSIONS,
  ROLE_PERMISSION_CATEGORIES: constants.ROLE_PERMISSION_CATEGORIES,

  // Application constants
  DEFAULT_PAGE: constants.DEFAULT_PAGE,
  DEFAULT_LIMIT: constants.DEFAULT_LIMIT,
  MAX_LIMIT: constants.MAX_LIMIT,
  USER_STATUS: constants.USER_STATUS,
  OTP_LENGTH: constants.OTP_LENGTH,
  OTP_EXPIRY_MINUTES: constants.OTP_EXPIRY_MINUTES,
  OTP_MAX_REQUESTS: constants.OTP_MAX_REQUESTS,
  OTP_REQUEST_WINDOW_MINUTES: constants.OTP_REQUEST_WINDOW_MINUTES,
  PASSWORD_MIN_LENGTH: constants.PASSWORD_MIN_LENGTH,
  PASSWORD_SALT_ROUNDS: constants.PASSWORD_SALT_ROUNDS,
  DEFAULT_SESSION_EXPIRY_HOURS: constants.DEFAULT_SESSION_EXPIRY_HOURS,
  MAX_SESSIONS_PER_USER: constants.MAX_SESSIONS_PER_USER,
  DEFAULT_BACKUP_RETENTION_DAYS: constants.DEFAULT_BACKUP_RETENTION_DAYS,
  MAX_BACKUP_RETENTION_DAYS: constants.MAX_BACKUP_RETENTION_DAYS,
  BACKUP_DIR: constants.BACKUP_DIR,
};
