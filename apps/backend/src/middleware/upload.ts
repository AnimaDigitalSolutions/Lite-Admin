import multer from 'multer';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import config from '../config/index.js';
import logger from '../utils/logger.js';

type MulterError = Error & {
  code?: string;
  field?: string;
};

interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Configure multer for memory storage (we'll handle file saving in storage service)
const storage = multer.memoryStorage();

// File filter
const fileFilter = (_req: Request, file: UploadedFile, cb: multer.FileFilterCallback) => {
  // Check file type
  if (!config.upload.allowedTypes.includes(file.mimetype)) {
    const error = new Error(`File type ${file.mimetype} is not allowed`) as MulterError;
    error.code = 'INVALID_FILE_TYPE';
    return cb(error);
  }
  
  // Additional security checks
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  
  if (!allowedExtensions.includes(ext)) {
    const error = new Error(`File extension ${ext} is not allowed`) as MulterError;
    error.code = 'INVALID_FILE_EXTENSION';
    return cb(error);
  }
  
  cb(null, true);
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1, // Single file upload only
  },
});

// Upload middleware for single file
const uploadSingle = (fieldName = 'image') => {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        logger.error({
          message: 'File upload error',
          error: err.message,
          code: err.code,
          field: err.field,
        });
        
        // Handle specific multer errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: {
              message: 'File size exceeds limit',
              status: 400,
              maxSize: config.upload.maxFileSize,
            },
          });
        }
        
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            error: {
              message: 'Unexpected field name',
              status: 400,
              expectedField: fieldName,
            },
          });
        }
        
        if (err.code === 'INVALID_FILE_TYPE' || err.code === 'INVALID_FILE_EXTENSION') {
          return res.status(400).json({
            error: {
              message: err.message,
              status: 400,
              allowedTypes: config.upload.allowedTypes,
            },
          });
        }
        
        // Generic error
        return res.status(400).json({
          error: {
            message: 'File upload failed',
            status: 400,
            details: err.message,
          },
        });
      }
      
      // Log successful upload
      if (req.file) {
        logger.info({
          message: 'File uploaded',
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
        });
      }
      
      next();
    });
  };
};

// Upload middleware for multiple files
const uploadMultiple = (fieldName = 'images', maxCount = 10) => {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.array(fieldName, maxCount)(req, res, (err) => {
      if (err) {
        logger.error({
          message: 'Multiple file upload error',
          error: err.message,
          code: err.code,
        });
        
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            error: {
              message: `Too many files. Maximum ${maxCount} allowed`,
              status: 400,
            },
          });
        }
        
        // Handle other errors same as single upload
        return uploadSingle(fieldName)(req, res, next);
      }
      
      // Log successful uploads
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        logger.info({
          message: 'Multiple files uploaded',
          count: req.files.length,
          totalSize: (req.files as UploadedFile[]).reduce((sum: number, file: UploadedFile) => sum + file.size, 0),
        });
      }
      
      next();
    });
  };
};

// Middleware to check if file exists
const requireFile = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file && (!req.files || req.files.length === 0)) {
    return res.status(400).json({
      error: {
        message: 'No file uploaded',
        status: 400,
      },
    });
  }
  next();
};

export { uploadSingle, uploadMultiple, requireFile };
export default uploadSingle;