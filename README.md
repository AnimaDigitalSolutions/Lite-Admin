<p align="center">
  <img src="apps/admin/public/crown-logo.png" alt="Lite Admin" width="64" />
</p>

<h1 align="center">Lite Admin</h1>

<p align="center">A lightweight TypeScript admin platform with CRM, email campaigns, media management, and invoicing — powered by Express and Next.js.</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node 20+" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

---

## Preview

<!-- Add screenshots here as they become available -->
<!-- screenshot: Dashboard — 30-day trend charts and at-a-glance stats -->
<!-- screenshot: CRM Kanban — Drag-and-drop contact pipeline -->
<!-- screenshot: Invoice Preview — PDF generation with line items -->
<!-- screenshot: Email Compose — Multi-recipient with contact picker -->
<!-- screenshot: Campaigns — Create and target email campaigns -->
<!-- screenshot: Media Gallery — Multi-format uploads with thumbnails -->

---

## Features

### CRM

- Kanban, Calendar, and Table views with 8-stage contact status workflow
- Notes & todos per contact with follow-up scheduling
- Bulk operations — multi-select delete for contacts
- IP duplicate detection with badge on repeated IPs

### Email

- Multi-recipient compose (To/CC/BCC) with contact picker and rich preview
- Campaigns — create, target by tags or all subscribers, track delivery
- Multi-provider support — AHASEND and Resend with runtime hot-swap
- Customizable HTML templates for contact and subscriber confirmation emails

### Invoicing

- Full CRUD with PDF generation and download
- Line items, tax/discount, multi-currency, templates

### Media

- Multi-format upload — video, PDF, and images
- Server-side thumbnail generation (Sharp + ffmpeg + MuPDF)
- Flexible storage — local filesystem and AWS S3

### Infrastructure

- TypeScript monorepo — Turbo.js orchestration with pnpm workspaces and shared type/schema package
- Multi-database support — SQLite, (future PostgreSQL, MySQL with seamless switching)
- Dashboard charts — 30-day trend visualizations for contacts and subscribers (Recharts)
- Activity log — auditable admin action history with per-entry deletion
- Multi-site support — site API keys (`X-Site-Key` header) to tag form submissions per site

### Security

- Smart rate limiting, CORS, JWT authentication, input validation, Helmet.js
- Geolocation — IP-based country/region enrichment on form submissions (MaxMind GeoLite2)
- Suspicious activity detection — automatic blocking of scanning attempts
- Integration tests — auth middleware, error handling, and validation middleware coverage

---

## Quick Start

> **Requires:** Node.js >= 20, pnpm >= 9. Docker is optional.

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

If you're looking for the default logins: `admin@email.com` / `changeme` ;)

Want to explore the dashboard without setting up a backend? Close the quickstart and Enable demo mode:

```bash
NEXT_PUBLIC_DEMO_MODE=true pnpm dev
```

Or seed real data into your database and start it up again afterwards:

```bash
pnpm db:seed
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) |
| Monorepo | Turbo.js + pnpm workspaces |
| Backend | Express.js |
| Frontend | Next.js 15 (App Router) |
| Database | SQLite (default) · PostgreSQL, MySQL planned |
| Email | AHASEND (default) · Resend planned |
| Storage | Local filesystem (default) · AWS S3 planned |
| Validation | Zod |
| Containerization | Docker + PM2 |

> **Defaults vs planned:** SQLite, AHASEND, and local storage are the tested defaults shipped today. PostgreSQL, MySQL, Resend, and S3 adapters are implemented but untested. GeoIP city-level enrichment is stubbed out. Contributions welcome.

---

## Admin Dashboard

Access the dashboard at `http://localhost:3002` after starting the dev server.

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | 30-day trend charts, at-a-glance stats |
| Contacts | `/contacts` | CRM with Table, Kanban, Calendar views; status pipeline; notes |
| Compose | `/compose` | Multi-recipient email with contact picker |
| Campaigns | `/campaigns` | Create, target, and send email campaigns |
| Invoices | `/invoices` | Create, preview, and download PDF invoices |
| Subscribers | `/subscribers` | Audience management with tags and segmentation |
| Media Gallery | `/media` | Upload and manage portfolio media with thumbnails |
| Statistics | `/stats` | Bar charts and server memory breakdown |
| Settings | `/settings` | Maintenance mode, email toggle, provider credentials |

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
pnpm test            # Run test suite
```

### Just Commands

```bash
just                 # List all commands
just quickstart      # Interactive setup
just dev             # Start development servers
just status          # Check service health
just test            # Run tests
just validate        # Lint + type-check
just docker-up       # Start Docker stack
just docker-down     # Stop Docker stack
just doctor          # Environment diagnostics
```

---

## Architecture

```
lite-admin/
├── apps/
│   ├── backend/               # Express.js API
│   │   └── src/
│   │       ├── routes/        # Auth, forms, media, admin/*
│   │       ├── services/      # Email, storage, geo, auth
│   │       ├── middleware/
│   │       └── schemas/       # Zod validation
│   └── admin/                 # Next.js 15 dashboard
│       ├── app/               # App Router pages
│       ├── components/        # UI primitives, contact detail
│       └── lib/               # API client, auth, theme
├── packages/
│   └── shared/                # @lite/shared — types, schemas, utils
├── docker/
└── turbo.json
```

---

## Deployment

### PM2

```bash
cd apps/backend
pm2 start ecosystem.config.js
```

### Docker

```bash
docker-compose -f docker/docker-compose.yml up -d          # Development
docker-compose -f docker/docker-compose.prod.yml up -d     # Production
```

### Production Checklist

1. Set strong `ADMIN_PASSWORD` and `JWT_SECRET`
2. Configure production database (PostgreSQL recommended)
3. Set up S3 for media storage
4. Configure email provider API keys
5. Update `ALLOWED_ORIGINS` for your domain
6. Set up SSL/TLS (caddy/traefil/nginx reverse proxy)
7. Build and serve the admin dashboard (`pnpm build`)

---

## Documentation

| Document | Description |
|---|---|
| [API Reference](docs/api.md) | Full endpoint documentation for public and admin APIs |
| [Configuration](docs/configuration.md) | Environment variables and runtime settings |
| [Database Schema](docs/schema.md) | Complete SQL schema for all tables |

---

## License

MIT — see [LICENSE](LICENSE) for details.

## Support
We are open to PRs ☕

Open an issue on GitHub or contact us at animadigitalsolutions.com.
