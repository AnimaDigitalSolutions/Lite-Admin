# Lite-Backend

A lightweight, modular TypeScript/Express monorepo with database abstraction, multi-provider email service, S3 media storage, and admin dashboard.

## Features

- **TypeScript Monorepo**: Modern development with Turbo.js orchestration
- **Multi-Database Support**: Seamless switching between SQLite, PostgreSQL, and MySQL
- **Multi-Provider Email**: AHASEND and Resend email service support
- **Flexible Storage**: Local filesystem and AWS S3 storage providers
- **Image Optimization**: Automatic image resizing and WebP conversion
- **Admin Dashboard**: Next.js admin interface with authentication
- **Advanced Security**: Smart rate limiting, CORS, JWT authentication, input validation
- **Production Ready**: Docker support, PM2 clustering, health checks

## Quick Start

```bash
# Clone the repository
git clone https://github.com/AnimaDigitalSolutions/Lite-Backend.git
cd Lite-Backend

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
pnpm dev
```

Or use the interactive setup:

```bash
just quickstart
```

## Installation

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker & Docker Compose (optional)

### Manual Installation

```bash
# Install dependencies
pnpm install

# Set up environment files
cp .env.example .env
cp apps/admin/.env.example apps/admin/.env
cp apps/backend/.env.example apps/backend/.env

# Edit configuration
nano .env

# Create required directories
mkdir -p database src/public/uploads/portfolio src/public/uploads/thumbnails

# Start development servers
pnpm dev
# Or start individual apps:
# pnpm dev:backend
# pnpm dev:admin
```

## Configuration

### Environment Variables

```env
# Backend Configuration (apps/backend/.env)
NODE_ENV=development
PORT=3001

# Admin Authentication
ADMIN_USERNAME=admin@example.com
ADMIN_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-jwt-refresh-secret

# Database (choose one)
DB_TYPE=sqlite                 # sqlite|postgres|mysql
DB_PATH=./database/lite.db     # For SQLite
DB_URL=                        # For PostgreSQL/MySQL

# Email Provider (choose one)
EMAIL_PROVIDER=ahasend         # ahasend|resend
AHASEND_API_KEY=
RESEND_API_KEY=

# Storage Provider (choose one)
STORAGE_PROVIDER=local         # local|s3
AWS_ACCESS_KEY_ID=             # For S3
AWS_SECRET_ACCESS_KEY=         # For S3
AWS_REGION=                    # For S3
AWS_S3_BUCKET=                 # For S3

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002

# Admin Dashboard Configuration (apps/admin/.env)
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## API Documentation

### Public Endpoints

#### Contact Form Submission
```http
POST /api/forms/contact
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "company": "ACME Corp",
  "project_type": "web",
  "message": "I need a custom ERP solution"
}
```

#### Waitlist Signup
```http
POST /api/forms/waitlist
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "Jane Doe"
}
```

#### Portfolio Media
```http
GET /api/media/portfolio?limit=50&offset=0&project=VERSAND.GURU
GET /api/media/:id
GET /api/media/:id/thumb?width=300&height=300&quality=85
```

### Admin Endpoints (JWT Authentication Required)

Include JWT token in headers:
```http
Authorization: Bearer your-jwt-token
```

#### Media Management
```http
POST /api/admin/media/upload
PUT /api/admin/media/:id
DELETE /api/admin/media/:id
```

#### Form Data Management
```http
GET /api/admin/submissions
DELETE /api/admin/submission/:id
GET /api/admin/waitlist
GET /api/admin/waitlist/export
```

#### System
```http
POST /api/admin/migrate
GET /api/admin/stats
```

#### Authentication
```http
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET /api/auth/me
```

## Admin Tools

### CLI Tools

#### Upload Images
```bash
# Single image
pnpm --filter backend exec tsx scripts/upload-image.ts --file ./image.jpg --project "VERSAND.GURU"

# Bulk upload
pnpm --filter backend exec tsx scripts/upload-image.ts --folder ./portfolio-images/
```

#### Export Data
```bash
# Export contacts
pnpm --filter backend exec tsx scripts/export-submissions.ts --type contacts --format csv

# Export waitlist
pnpm --filter backend exec tsx scripts/export-submissions.ts --type waitlist --format json
```

#### Database Cleanup
```bash
# Clean data older than 90 days
pnpm --filter backend exec tsx scripts/clean-database.ts --days 90

# Dry run
pnpm --filter backend exec tsx scripts/clean-database.ts --days 90 --dry-run
```

### Interactive Admin CLI
```bash
pnpm --filter backend exec tsx tools/admin-cli.ts
```

### Admin Dashboard
Access the web-based admin dashboard at `http://localhost:3002` after starting the development server.

## Development

### Available Scripts

```bash
# Development servers (both backend and admin)
pnpm dev

# Individual development servers
pnpm dev:backend    # Backend only on port 3001
pnpm dev:admin      # Admin dashboard only on port 3002

# Run tests
pnpm test

# Type checking
pnpm type-check

# Lint code
pnpm lint

# Format code
pnpm format

# Database migrations
pnpm db:migrate

# Production build
pnpm build

# Clean build artifacts
pnpm clean
```

### Just Commands

```bash
# Show all commands
just

# Quick setup
just quickstart

# Development
just dev
just status
just logs

# Database
just db-init
just db-backup
just db-reset

# Admin operations
just admin
just upload-image FILE=image.jpg
just export-submissions

# Docker
just docker-build
just docker-up
just docker-down

# Utilities
just doctor
just clean
just kill-port
```

## Deployment

### PM2 Deployment

```bash
# Start backend with PM2
cd apps/backend
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# Logs
pm2 logs lite-backend
```

### Docker Deployment

```bash
# Build and run
docker-compose -f docker/docker-compose.yml up -d

# Production deployment
docker-compose -f docker/docker-compose.prod.yml up -d

# Check logs
docker-compose logs -f app
```

### Production Checklist

1. Set strong `ADMIN_PASSWORD` and `JWT_SECRET`
2. Configure production database (PostgreSQL recommended)
3. Set up S3 for media storage
4. Configure email provider API keys
5. Update CORS allowed origins
6. Set up SSL/TLS certificates
7. Configure proper backup strategy
8. Set up monitoring and alerts
9. Build and deploy admin dashboard
10. Configure reverse proxy (nginx) for both backend and admin

## Architecture

### Directory Structure

```
lite-backend/
├── apps/
│   ├── backend/               # Express.js Backend
│   │   ├── src/
│   │   │   ├── app.ts         # Express app configuration
│   │   │   ├── server.ts      # Server entry point
│   │   │   ├── config/        # Configuration
│   │   │   ├── routes/        # API routes
│   │   │   ├── services/      # Business logic
│   │   │   │   ├── auth/      # Authentication services
│   │   │   │   ├── email/     # Email services
│   │   │   │   ├── storage/   # Storage services
│   │   │   │   └── forms/     # Form processing
│   │   │   ├── middleware/    # Express middleware
│   │   │   ├── schemas/       # Zod validation schemas
│   │   │   └── utils/         # Utilities
│   │   ├── scripts/           # CLI scripts
│   │   └── tools/             # Admin tools
│   └── admin/                 # Next.js Admin Dashboard
│       ├── app/               # App Router pages
│       ├── components/        # React components
│       └── lib/               # Utilities and API client
├── packages/                  # Shared packages
├── docker/                    # Docker configuration
├── tests/                     # Test files
└── turbo.json                 # Turbo configuration
```

### Technology Stack

- **Language**: TypeScript
- **Monorepo**: Turbo.js with pnpm workspaces
- **Backend Framework**: Express.js
- **Frontend Framework**: Next.js 15 (App Router)
- **UI Components**: Radix UI + Tailwind CSS
- **Authentication**: JWT with refresh tokens
- **Validation**: Zod
- **Database**: SQLite/PostgreSQL/MySQL
- **Email**: AHASEND/Resend
- **Storage**: Local/S3
- **Image Processing**: Sharp
- **Logging**: Pino
- **Security**: Helmet, CORS, Smart Rate Limiting
- **Process Manager**: PM2
- **Containerization**: Docker

## Database Schema

```sql
-- Contacts
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(255),
  company VARCHAR(100),
  project_type VARCHAR(50),
  message TEXT,
  submitted_at TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- Waitlist
CREATE TABLE waitlist (
  id INTEGER PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  name VARCHAR(100),
  signed_up_at TIMESTAMP,
  ip_address VARCHAR(45)
);

-- Portfolio Media
CREATE TABLE portfolio_media (
  id INTEGER PRIMARY KEY,
  filename VARCHAR(255),
  original_name VARCHAR(255),
  project_name VARCHAR(100),
  description TEXT,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  mime_type VARCHAR(50),
  storage_provider VARCHAR(20),
  storage_path VARCHAR(500),
  uploaded_at TIMESTAMP
);

-- Admin Logs
CREATE TABLE admin_logs (
  id INTEGER PRIMARY KEY,
  action VARCHAR(100),
  resource VARCHAR(100),
  resource_id INTEGER,
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP
);
```

## Security

- **Smart Rate Limiting**: Origin-based adaptive rate limiting
- **CORS**: Whitelist allowed origins
- **Input Validation**: Comprehensive Zod schema validation
- **File Upload**: Type and size restrictions with image optimization
- **JWT Authentication**: Secure admin authentication with refresh tokens
- **SQL Injection Protection**: Parameterized queries
- **XSS Prevention**: Input sanitization
- **Suspicious Activity Detection**: Automatic blocking of scanning attempts
- **Helmet.js**: Security headers and protections

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@animadigitalsolutions.com or open an issue on GitHub.