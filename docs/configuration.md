# Configuration

## Environment Variables

```env
# apps/backend/.env

NODE_ENV=development
PORT=3001

# Admin Authentication
ADMIN_USERNAME=admin@example.com
ADMIN_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-jwt-refresh-secret
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Database (choose one)
DB_TYPE=sqlite                 # sqlite | postgres | mysql
DB_PATH=./database/lite.db     # SQLite only
DB_URL=                        # PostgreSQL / MySQL connection string

# Email Provider (choose one)
EMAIL_PROVIDER=ahasend         # ahasend | resend
AHASEND_API_KEY=
AHASEND_ACCOUNT_ID=
RESEND_API_KEY=
EMAIL_FROM=noreply@example.com

# Storage Provider (choose one)
STORAGE_PROVIDER=local         # local | s3
AWS_ACCESS_KEY_ID=             # S3 only
AWS_SECRET_ACCESS_KEY=         # S3 only
AWS_REGION=                    # S3 only
AWS_S3_BUCKET=                 # S3 only

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info

# File Uploads
MAX_FILE_SIZE=52428800
ALLOWED_FILE_TYPES=image/*,video/*,application/pdf
IMAGE_QUALITY=85
THUMBNAIL_WIDTH=300
THUMBNAIL_HEIGHT=300

# apps/admin/.env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

> Provider credentials can also be overridden at runtime via the Settings → Provider Credentials page in the admin dashboard. Email changes take effect immediately without a restart.
