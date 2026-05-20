const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const storagePath = require('./storagePath');
const { logger } = require('../middlewares/activityLog');
const { AppError } = require('./appError');

// ==========================================
// STORAGE CONFIGURATION
// ==========================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.uploadFolder || 'uploads';
    const fullPath = storagePath(folder);
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const randomPrefix = Date.now() + '-' + Math.floor(Math.random() * 10000);
    const fileName = `${randomPrefix}-${uuidv4()}${ext}`;
    req.uploadFilename = fileName;
    cb(null, fileName);
  },
});

// ==========================================
// FILE FILTER
// ==========================================

const fileFilter = (req, file, cb) => {
  const allowedMimes = req.allowedMimes || [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ];
  const allowedExtensions = req.allowedExtensions || [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.svg',
  ];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Invalid file type. Allowed: ${allowedExtensions.join(', ')}`,
        400,
      ),
    );
  }
};

// ==========================================
// MULTER CONFIG
// ==========================================

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
  },
});

// ==========================================
// UPLOAD HELPERS
// ==========================================

/**
 * Create a multer upload middleware for specific folder and file types
 * @param {Object} options - Configuration options
 * @param {string} options.folder - Destination folder (default: "uploads")
 * @param {Array} options.allowedMimes - Allowed MIME types
 * @param {Array} options.allowedExtensions - Allowed file extensions
 * @param {number} options.maxFileSize - Max file size in bytes
 * @returns {Function} Multer middleware
 */
exports.upload = (options = {}) => {
  const {
    folder = 'uploads',
    allowedMimes,
    allowedExtensions,
    maxFileSize,
  } = options;

  // Create a new multer instance with custom file size if specified
  const uploader = maxFileSize
    ? multer({
        storage,
        fileFilter,
        limits: { fileSize: maxFileSize },
      })
    : upload;

  return (req, res, next) => {
    req.uploadFolder = folder;
    req.allowedMimes = allowedMimes;
    req.allowedExtensions = allowedExtensions;

    uploader.single('file')(req, res, (err) => {
      if (err instanceof AppError) {
        return next(err);
      }
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(
              `File too large. Max size: ${maxFileSize / 1024 / 1024}MB`,
              400,
            ),
          );
        }
        return next(err);
      }
      next();
    });
  };
};

/**
 * Create a multer multi-upload middleware
 */
exports.uploadMulti = (options = {}) => {
  const {
    folder = 'uploads',
    allowedMimes,
    allowedExtensions,
    maxFileSize,
    maxFiles = 5,
  } = options;

  return (req, res, next) => {
    req.uploadFolder = folder;
    req.allowedMimes = allowedMimes;
    req.allowedExtensions = allowedExtensions;

    upload.array('files', maxFiles)(req, res, (err) => {
      if (err instanceof AppError) {
        return next(err);
      }
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(
              `File too large. Max size: ${maxFileSize / 1024 / 1024}MB`,
              400,
            ),
          );
        }
        return next(err);
      }
      next();
    });
  };
};

/**
 * Delete uploaded file
 * @param {string} filename - Name of the file to delete
 * @param {string} folder - Folder path
 */
exports.deleteUpload = (filename, folder = 'uploads') => {
  const fs = require('fs');
  const filePath = storagePath(folder, filename);

  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        logger.error(`Failed to delete file: ${filePath}`, err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Get public URL for uploaded file
 * @param {string} filename - Name of the file
 * @param {string} folder - Folder path
 */
exports.getUploadUrl = (filename, folder = 'uploads') => {
  return `/${folder}/${filename}`;
};
