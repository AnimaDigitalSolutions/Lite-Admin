import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import type { DatabaseConfig, EmailConfig, StorageConfig } from '@lite/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

interface Config {
  env: string;
  port: number;
  adminUsername: string;
  adminPassword: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  
  database: DatabaseConfig;
  email: EmailConfig;
  storage: StorageConfig;
  
  cors: {
    origins: string[];
  };
  
  rateLimit: {
    windowMs: number;
    max: number;
  };
  
  logging: {
    level: string;
  };
  
  upload: {
    maxFileSize: number;
    allowedTypes: string[];
  };
  
  image: {
    quality: number;
    thumbnail: {
      width: number;
      height: number;
    };
  };
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  adminUsername: process.env.ADMIN_USERNAME || 'admin@email.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'changeme',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  
  database: {
    type: (process.env.DB_TYPE || 'sqlite') as 'sqlite' | 'postgres' | 'mysql',
    path: process.env.DB_PATH || path.join(__dirname, '../../database/lite.db'),
    url: process.env.DB_URL,
  },
  
  email: {
    provider: (process.env.EMAIL_PROVIDER || 'ahasend') as 'ahasend' | 'resend',
    from: process.env.EMAIL_FROM || 'noreply@animadigitalsolutions.com',
    ahasend: {
      apiKey: process.env.AHASEND_API_KEY || '',
      accountId: process.env.AHASEND_ACCOUNT_ID || '',
    },
    resend: {
      apiKey: process.env.RESEND_API_KEY || '',
    },
  },
  
  storage: {
    provider: (process.env.STORAGE_PROVIDER || 'local') as 'local' | 's3',
    local: {
      uploadDir: path.join(__dirname, '../public/uploads'),
    },
    s3: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_REGION || '',
      bucket: process.env.AWS_S3_BUCKET || '',
    },
  },
  
  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3002'],
  },
  
  rateLimit: {
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW || '30', 10) * 1000),
    max: parseInt(process.env.RATE_LIMIT_MAX || '10', 10),
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ],
  },
  
  image: {
    quality: parseInt(process.env.IMAGE_QUALITY || '85', 10),
    thumbnail: {
      width: parseInt(process.env.THUMBNAIL_WIDTH || '300', 10),
      height: parseInt(process.env.THUMBNAIL_HEIGHT || '300', 10),
    },
  },
};

// Validate critical configuration
if (config.env === 'production') {
  if (config.adminPassword === 'changeme') {
    throw new Error('ADMIN_PASSWORD must be changed in production');
  }
  if (config.jwtSecret === 'your-secret-key-change-in-production') {
    throw new Error('JWT_SECRET must be changed in production');
  }
}

export default config;