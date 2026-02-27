import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3001,
  adminApiKey: process.env.ADMIN_API_KEY,
  
  database: {
    type: process.env.DB_TYPE || 'sqlite',
    path: process.env.DB_PATH || path.join(__dirname, '../../database/lite.db'),
    url: process.env.DB_URL,
  },
  
  email: {
    provider: process.env.EMAIL_PROVIDER || 'ahasend',
    from: process.env.EMAIL_FROM || 'noreply@animadigitalsolutions.com',
    ahasend: {
      apiKey: process.env.AHASEND_API_KEY,
    },
    resend: {
      apiKey: process.env.RESEND_API_KEY,
    },
  },
  
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    local: {
      uploadDir: path.join(__dirname, '../public/uploads'),
    },
    s3: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
      bucket: process.env.AWS_S3_BUCKET,
    },
  },
  
  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) * 1000 || 30000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 10,
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760, // 10MB
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ],
  },
  
  image: {
    quality: parseInt(process.env.IMAGE_QUALITY, 10) || 85,
    thumbnail: {
      width: parseInt(process.env.THUMBNAIL_WIDTH, 10) || 300,
      height: parseInt(process.env.THUMBNAIL_HEIGHT, 10) || 300,
    },
  },
};

export default config;