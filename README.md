# Lite-Backend

A lightweight, modular Node.js/Express backend with database abstraction, multi-provider email service, S3 media storage, and admin functionality.

## Features

- **Multi-Database Support**: Seamless switching between SQLite, PostgreSQL, and MySQL
- **Multi-Provider Email**: AHASEND and Resend email service support
- **Flexible Storage**: Local filesystem and AWS S3 storage providers
- **Image Optimization**: Automatic image resizing and WebP conversion
- **Admin Dashboard**: CLI tools for managing content and data
- **Security**: Rate limiting, CORS, API key authentication, input validation
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
- pnpm >= 10.0.0
- Docker & Docker Compose (optional)

### Manual Installation

```bash
# Install dependencies
pnpm install

# Create environment file
cp .env.example .env

# Edit configuration
nano .env

# Create required directories
mkdir -p database src/public/uploads/portfolio src/public/uploads/thumbnails

# Start server
pnpm dev
```

## Configuration

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=3001
ADMIN_API_KEY=your-secret-admin-key

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
ALLOWED_ORIGINS=http://localhost:3000,https://animadigitalsolutions.com

# Rate Limiting
RATE_LIMIT_WINDOW=30           # seconds
RATE_LIMIT_MAX=10              # requests per window
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

### Admin Endpoints (API Key Required)

Include API key in headers:
```http
X-API-Key: your-admin-api-key
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

## Admin Tools

### CLI Tools

#### Upload Images
```bash
# Single image
node scripts/upload-image.js --file ./image.jpg --project "VERSAND.GURU"

# Bulk upload
node scripts/upload-image.js --folder ./portfolio-images/
```

#### Export Data
```bash
# Export contacts
node scripts/export-submissions.js --type contacts --format csv

# Export waitlist
node scripts/export-submissions.js --type waitlist --format json
```

#### Database Cleanup
```bash
# Clean data older than 90 days
node scripts/clean-database.js --days 90

# Dry run
node scripts/clean-database.js --days 90 --dry-run
```

### Interactive Admin CLI
```bash
node tools/admin-cli.js
```

## Development

### Available Scripts

```bash
# Development server with hot reload
pnpm dev

# Run tests
pnpm test

# Lint code
pnpm lint

# Database migrations
pnpm db:migrate

# Production build
pnpm build
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
# Start with PM2
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

1. Set strong `ADMIN_API_KEY`
2. Configure production database (PostgreSQL recommended)
3. Set up S3 for media storage
4. Configure email provider API keys
5. Update CORS allowed origins
6. Set up SSL/TLS certificates
7. Configure proper backup strategy
8. Set up monitoring and alerts

## Architecture

### Directory Structure

```
lite-backend/
├── src/
│   ├── app.js                 # Express app configuration
│   ├── server.js              # Server entry point
│   ├── config/                # Configuration
│   ├── database/              # Database abstraction
│   │   ├── adapters/          # Database adapters
│   │   └── models/            # Data models
│   ├── routes/                # API routes
│   ├── services/              # Business logic
│   │   ├── email/             # Email services
│   │   ├── storage/           # Storage services
│   │   └── forms/             # Form processing
│   ├── middleware/            # Express middleware
│   ├── schemas/               # Zod validation schemas
│   └── utils/                 # Utilities
├── scripts/                   # CLI scripts
├── tools/                     # Admin tools
├── docker/                    # Docker configuration
└── tests/                     # Test files
```

### Technology Stack

- **Framework**: Express.js
- **Validation**: Zod
- **Database**: SQLite/PostgreSQL/MySQL
- **Email**: AHASEND/Resend
- **Storage**: Local/S3
- **Image Processing**: Sharp
- **Logging**: Pino
- **Security**: Helmet, CORS, bcryptjs
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

- **Rate Limiting**: Configurable per-IP request limits
- **CORS**: Whitelist allowed origins
- **Input Validation**: Zod schema validation
- **File Upload**: Type and size restrictions
- **API Authentication**: Admin endpoints require API key
- **SQL Injection Protection**: Parameterized queries
- **XSS Prevention**: Input sanitization

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