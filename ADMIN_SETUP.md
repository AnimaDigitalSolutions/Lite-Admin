# Admin Dashboard Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
# Install all dependencies for the monorepo
pnpm install
```

### 2. Environment Setup
```bash
# Copy environment files
cp .env.example .env
cp apps/admin/.env.example apps/admin/.env

# Edit environment variables
nano .env  # Backend config
nano apps/admin/.env  # Frontend config
```

### 3. Start Development Servers

#### Option A: Run both apps
```bash
pnpm dev
```

#### Option B: Run individually
```bash
# Terminal 1 - Backend (port 3001)
pnpm dev:backend

# Terminal 2 - Admin Dashboard (port 3002)
pnpm dev:admin
```

### 4. Access the Admin Dashboard
- **Admin Dashboard**: http://localhost:3002
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### 5. Default Login
- **Username**: `admin`
- **Password**: `changeme`

## Features Implemented

### ✅ Authentication
- JWT-based authentication with httpOnly cookies
- Protected routes with middleware
- Automatic token refresh
- Secure login/logout

### ✅ Media Gallery
- Drag-and-drop image upload
- Image preview and metadata editing
- Delete functionality with confirmation
- Search and filter by project
- Responsive grid layout

### ✅ Contact Management
- View all contact form submissions
- Search and filter contacts
- Export to CSV
- Delete individual submissions
- Detailed view modal with reply option

### ✅ Waitlist Management
- View all waitlist signups
- Bulk selection and operations
- Export functionality
- Quick actions (email all, recent emails)
- Statistics cards

### ✅ Dashboard
- System statistics overview
- Real-time data from backend
- Quick navigation

### ✅ Statistics (Placeholder)
- Coming soon page with roadmap
- Placeholder for future analytics features

## Architecture

```
Lite-Admin/
├── apps/
│   ├── backend/          Express.js API (TypeScript)
│   └── admin/           Next.js Dashboard (TypeScript)
├── packages/
│   └── shared/          Shared types and schemas
└── Configuration files
```

## API Integration

The admin dashboard integrates with backend APIs:

- **Authentication**: `/api/auth/*`
- **Media Management**: `/api/admin/media/*`
- **Form Data**: `/api/admin/submissions`, `/api/admin/waitlist`
- **Statistics**: `/api/admin/stats`

## Security Features

- httpOnly cookies for web security
- CSRF protection via SameSite cookies
- Rate limiting based on origin trust
- JWT token validation
- Protected API endpoints

## Development Notes

### Tech Stack
- **Backend**: Express.js + TypeScript + JWT + Native Crypto
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS + Radix UI
- **Shared**: Type definitions and validation schemas

### Key Dependencies
- `@radix-ui/*` - UI components
- `react-dropzone` - File uploads
- `@tanstack/react-table` - Data tables
- `axios` - HTTP client
- `js-cookie` - Cookie management

## Production Considerations

Before deploying to production:

1. **Change default credentials** in `.env`
2. **Set strong JWT_SECRET**
3. **Configure CORS origins** properly
4. **Set up HTTPS** for secure cookies
5. **Configure production database**
6. **Set up file storage** (S3 recommended)

## Troubleshooting

### Common Issues

1. **CORS Errors**: Check `ALLOWED_ORIGINS` in backend `.env`
2. **Login Issues**: Verify credentials in backend `.env`
3. **File Upload Issues**: Check storage provider configuration
4. **Port Conflicts**: Ensure ports 3001/3002 are available

### Development Commands

```bash
# Type checking
pnpm type-check

# Linting
pnpm lint

# Build for production
pnpm build

# Clean install
pnpm clean && pnpm install
```

## Next Steps

The admin dashboard is now fully functional for core operations. Future enhancements could include:

- Advanced analytics with charts
- Real-time notifications
- User role management
- Automated backups
- Performance monitoring

The foundation is solid and ready for production use!