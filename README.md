<p align="center">
  <img src="apps/admin/public/crown-logo.png" alt="Lite Admin" width="64" />
</p>

<h1 align="center">Lite Admin</h1>

<p align="center">A lightweight, modular TypeScript/Express monorepo with database abstraction, multi-provider email, S3 media storage, and a full-featured Next.js admin dashboard.</p>

---

## Features

- **TypeScript Monorepo** — Turbo.js orchestration with pnpm workspaces
- **Multi-Database Support** — SQLite, PostgreSQL, MySQL with seamless switching
- **Multi-Provider Email** — AHASEND and Resend with runtime hot-swap
- **Flexible Storage** — Local filesystem and AWS S3
- **Image Optimization** — Automatic resizing and WebP conversion via Sharp
- **Admin Dashboard** — Next.js 15 App Router with authentication and sidebar navigation
- **Settings Management** — Runtime toggles, maintenance mode, provider credentials (no restart required for email)
- **Activity Log** — Auditable admin action history with per-entry deletion
- **Multi-Site Support** — Site API keys (`X-Site-Key` header) to tag form submissions per site
- **Dashboard Charts** — 30-day trend visualizations for contacts and waitlist (Recharts)
- **Bulk Operations** — Multi-select delete for contacts and waitlist entries
- **IP Duplicate Detection** — Badge on repeated IPs in waitlist view
- **Advanced Security** — Smart rate limiting, CORS, JWT authentication, input validation, Helmet.js

---

## Quick Start

```bash
git clone https://github.com/AnimaDigitalSolutions/Lite-Admin.git
cd Lite-Admin
pnpm install
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your configuration
pnpm dev
```

Or with the interactive setup:

```bash
just quickstart
```

---

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker & Docker Compose (optional)

---

## Configuration

### Environment Variables

```env
# apps/backend/.env

NODE_ENV=development
PORT=3001

# Admin Authentication
ADMIN_USERNAME=admin@example.com
ADMIN_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-jwt-refresh-secret

# Database (choose one)
DB_TYPE=sqlite                 # sqlite | postgres | mysql
DB_PATH=./database/lite.db     # SQLite only
DB_URL=                        # PostgreSQL / MySQL connection string

# Email Provider (choose one)
EMAIL_PROVIDER=ahasend         # ahasend | resend
AHASEND_API_KEY=
RESEND_API_KEY=

# Storage Provider (choose one)
STORAGE_PROVIDER=local         # local | s3
AWS_ACCESS_KEY_ID=             # S3 only
AWS_SECRET_ACCESS_KEY=         # S3 only
AWS_REGION=                    # S3 only
AWS_S3_BUCKET=                 # S3 only

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002

# apps/admin/.env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

> Provider credentials can also be overridden at runtime via the Settings → Provider Credentials page in the admin dashboard. Email changes take effect immediately without a restart.

---

## Admin Dashboard

Access the dashboard at `http://localhost:3002` after starting the dev server.

### Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | 30-day contact and waitlist trend charts, at-a-glance stats |
| Media Gallery | `/media` | Upload, view, and delete portfolio images |
| Contacts | `/contacts` | View, export CSV, and bulk-delete contact submissions |
| Waitlist | `/waitlist` | View signups with IP duplicate badges, bulk-delete, export CSV |
| Statistics | `/stats` | Bar charts and server memory breakdown |
| Activity Log | `/logs` | Admin action history with per-entry and clear-all delete |
| Settings | `/settings` | Maintenance mode, email toggle, site API keys, provider credentials |

---

## API Documentation

### Public Endpoints

#### Contact Form Submission

```http
POST /api/forms/contact
Content-Type: application/json
X-Site-Key: lsk_...   (optional — tags the submission to a site)

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
X-Site-Key: lsk_...   (optional)

{
  "email": "user@example.com",
  "name": "Jane Doe"
}
```

#### Portfolio Media

```http
GET /api/media/portfolio?limit=50&offset=0&project=MY_PROJECT
GET /api/media/:id
GET /api/media/:id/thumb?width=300&height=300&quality=85
```

### Admin Endpoints

All admin endpoints require a JWT token:

```http
Authorization: Bearer your-jwt-token
```

#### Authentication

```http
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

#### Media Management

```http
POST   /api/admin/media/upload
PUT    /api/admin/media/:id
DELETE /api/admin/media/:id
```

#### Form Data

```http
GET    /api/admin/submissions
DELETE /api/admin/submission/:id
POST   /api/admin/submissions/bulk-delete   { "ids": [1, 2, 3] }

GET    /api/admin/waitlist
GET    /api/admin/waitlist/export
POST   /api/admin/waitlist/bulk-delete      { "ids": [1, 2, 3] }
```

#### Settings & Credentials

```http
GET /api/admin/settings
PUT /api/admin/settings         { "key": "maintenance_mode", "value": "true" }

GET /api/admin/credentials
PUT /api/admin/credentials      { "email_ahasend_api_key": "...", ... }
```

Available setting keys: `email_enabled`, `maintenance_mode`, `maintenance_message`

#### Activity Log

```http
GET    /api/admin/logs?limit=50&offset=0
DELETE /api/admin/logs/:id
DELETE /api/admin/logs          (clear all)
```

#### Sites (Multi-Site API Keys)

```http
GET    /api/admin/sites
POST   /api/admin/sites                     { "name": "My Site" }
POST   /api/admin/sites/:id/regenerate      (rotate API key)
PATCH  /api/admin/sites/:id                 { "active": false }
DELETE /api/admin/sites/:id
```

#### System

```http
POST /api/admin/migrate
GET  /api/admin/stats
```

---

## Multi-Site Support

Create a site in Settings → Sites & API Keys to get an `lsk_` prefixed API key. Send it with every form submission via the `X-Site-Key` header. Submissions tagged to a site appear with the `site_id` in the database.

The header is optional — existing integrations without it continue to work unchanged.

---

## Development

### Scripts

```bash
pnpm dev             # Both backend and admin
pnpm dev:backend     # Backend only (port 3001)
pnpm dev:admin       # Admin dashboard only (port 3002)
pnpm build           # Production build
pnpm lint            # Lint all packages
pnpm type-check      # TypeScript check all packages
pnpm clean           # Remove build artifacts
```

### Just Commands

```bash
just                 # List all commands
just quickstart      # Interactive setup
just dev             # Start development servers
just status          # Check service health
just logs            # Tail logs
just db-init         # Initialize database
just db-backup       # Backup database
just db-reset        # Reset database
just docker-build    # Build Docker images
just docker-up       # Start Docker stack
just docker-down     # Stop Docker stack
just doctor          # Environment diagnostics
just clean           # Clean build artifacts
```

### CLI Scripts

```bash
# Upload images
pnpm --filter backend exec tsx scripts/upload-image.ts --file ./image.jpg --project "MY_PROJECT"
pnpm --filter backend exec tsx scripts/upload-image.ts --folder ./portfolio-images/

# Export data
pnpm --filter backend exec tsx scripts/export-submissions.ts --type contacts --format csv
pnpm --filter backend exec tsx scripts/export-submissions.ts --type waitlist --format json

# Database cleanup
pnpm --filter backend exec tsx scripts/clean-database.ts --days 90
pnpm --filter backend exec tsx scripts/clean-database.ts --days 90 --dry-run

# Interactive admin CLI
pnpm --filter backend exec tsx tools/admin-cli.ts
```

---

## Architecture

### Directory Structure

```
lite-admin/
├── apps/
│   ├── backend/               # Express.js backend
│   │   └── src/
│   │       ├── app.ts
│   │       ├── server.ts
│   │       ├── config/
│   │       ├── routes/        # API route handlers
│   │       ├── services/
│   │       │   ├── auth/
│   │       │   ├── email/     # Multi-provider email factory
│   │       │   ├── forms/     # Contact & waitlist processing
│   │       │   ├── settings/  # Runtime settings (singleton)
│   │       │   └── storage/
│   │       ├── middleware/
│   │       ├── schemas/       # Zod validation
│   │       └── types/
│   └── admin/                 # Next.js 15 admin dashboard
│       ├── app/               # App Router pages
│       │   ├── page.tsx       # Dashboard
│       │   ├── contacts/
│       │   ├── waitlist/
│       │   ├── media/
│       │   ├── stats/
│       │   ├── logs/
│       │   └── settings/
│       ├── components/
│       └── lib/               # API client, auth context
├── packages/                  # Shared packages
├── docker/
└── turbo.json
```

### Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Monorepo | Turbo.js + pnpm workspaces |
| Backend | Express.js |
| Frontend | Next.js 15 (App Router) |
| UI | Radix UI + Tailwind CSS + Recharts |
| Auth | JWT with refresh tokens |
| Validation | Zod |
| Database | SQLite / PostgreSQL / MySQL |
| Email | AHASEND / Resend |
| Storage | Local / AWS S3 |
| Image Processing | Sharp |
| Logging | Pino |
| Security | Helmet, CORS, Smart Rate Limiting |
| Process Manager | PM2 |
| Containerization | Docker |

---

## Database Schema

```sql
CREATE TABLE contacts (
  id          INTEGER PRIMARY KEY,
  name        VARCHAR(100),
  email       VARCHAR(255),
  company     VARCHAR(100),
  project_type VARCHAR(50),
  message     TEXT,
  submitted_at TIMESTAMP,
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  site_id     INTEGER REFERENCES sites(id)
);

CREATE TABLE waitlist (
  id          INTEGER PRIMARY KEY,
  email       VARCHAR(255) UNIQUE,
  name        VARCHAR(100),
  signed_up_at TIMESTAMP,
  ip_address  VARCHAR(45),
  site_id     INTEGER REFERENCES sites(id)
);

CREATE TABLE portfolio_media (
  id               INTEGER PRIMARY KEY,
  filename         VARCHAR(255),
  original_name    VARCHAR(255),
  project_name     VARCHAR(100),
  description      TEXT,
  file_size        INTEGER,
  width            INTEGER,
  height           INTEGER,
  mime_type        VARCHAR(50),
  storage_provider VARCHAR(20),
  storage_path     VARCHAR(500),
  uploaded_at      TIMESTAMP
);

CREATE TABLE admin_logs (
  id          INTEGER PRIMARY KEY,
  action      VARCHAR(100),
  resource    VARCHAR(100),
  resource_id INTEGER,
  details     TEXT,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMP
);

CREATE TABLE settings (
  key   VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE sites (
  id         INTEGER PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  api_key    VARCHAR(64) UNIQUE,
  active     BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Deployment

### PM2

```bash
cd apps/backend
pm2 start ecosystem.config.js
pm2 monit
pm2 logs lite-admin
```

### Docker

```bash
# Development
docker-compose -f docker/docker-compose.yml up -d

# Production
docker-compose -f docker/docker-compose.prod.yml up -d
docker-compose logs -f app
```

### Production Checklist

1. Set strong `ADMIN_PASSWORD` and `JWT_SECRET`
2. Configure production database (PostgreSQL recommended)
3. Set up S3 for media storage
4. Configure email provider API keys
5. Update `ALLOWED_ORIGINS` for your domain
6. Set up SSL/TLS (nginx reverse proxy)
7. Configure backup strategy for the database
8. Set up monitoring and alerts
9. Build and serve the admin dashboard (`pnpm build`)

---

## Security

- **Smart Rate Limiting** — origin-based adaptive limiting with strict mode for form endpoints
- **CORS** — configurable origin whitelist
- **Input Validation** — Zod schemas on all endpoints
- **File Upload** — type and size restrictions with automatic image optimization
- **JWT Authentication** — short-lived access tokens + refresh token rotation
- **SQL Injection Protection** — parameterized queries throughout
- **XSS Prevention** — input sanitization
- **Helmet.js** — security headers
- **Suspicious Activity Detection** — automatic blocking of scanning attempts
- **Site API Keys** — `lsk_`-prefixed keys for multi-site form attribution

---

## License

MIT — see [LICENSE](LICENSE) for details.

## Support

Open an issue on GitHub or email support@animadigitalsolutions.com.
