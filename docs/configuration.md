# Configuration

## Environment Variables

All configuration lives in a single `.env` file at the **repository root**. Copy `.env.example` to get started:

```bash
cp .env.example .env
```

```env
# Server
NODE_ENV=development
PORT=3001              # backend API port (also injected automatically by most deployment platforms)
ADMIN_PORT=3002        # admin panel port
NEXT_PUBLIC_API_URL=http://localhost:3001/api  # must match PORT above

# Admin Authentication
ADMIN_USERNAME=admin@example.com
ADMIN_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret
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

# CORS — in development all origins are allowed; this list is enforced in production only
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002,https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW=30           # seconds
RATE_LIMIT_MAX=10              # requests per window

# Logging
LOG_LEVEL=info                 # error | warn | info | debug

# File Uploads
MAX_FILE_SIZE=52428800         # bytes (50 MB)
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf
IMAGE_QUALITY=85
THUMBNAIL_WIDTH=300
THUMBNAIL_HEIGHT=300
```

> Provider credentials (email keys, storage keys) can also be overridden at runtime via **Settings → Provider Credentials** in the admin dashboard. Changes take effect immediately without a restart.

---

## Customization

### Themes

The admin panel ships with two themes — **Café Sepia** (default, light) and **Ocean** (dark). Adding or editing a theme requires changes in two files:

**1. `apps/admin/lib/theme-context.tsx`** — register the theme:

```ts
export const THEMES = [
  { id: 'cafe-sepia', label: 'Café Sepia', swatch: '#f5f0e8' },
  { id: 'ocean',      label: 'Ocean',      swatch: '#151c2c' },
  // Add your theme here — { id, label, swatch hex }
] as const;
```

The first entry in the array is the default theme shown to first-time visitors.

**2. `apps/admin/app/globals.css`** — add CSS variables for your theme:

```css
[data-theme="your-theme-id"] {
  --background: …;
  --foreground: …;
  --primary: …;
  /* see existing blocks for the full list of required variables */
}
```

The `[data-theme]` selector must match the `id` you registered in `theme-context.tsx`. All standard CSS variable names are documented in the existing theme blocks in `globals.css`.

### Ports

Change `PORT` (backend) and `ADMIN_PORT` (admin panel) in the root `.env`. Update `NEXT_PUBLIC_API_URL` to match whenever `PORT` changes.

---

## Adding a New Module

A module is a new page/feature in the admin panel. Adding one requires changes in 6 places.

Use `reports` as the example name — replace it with your module name throughout.

---

**1. Frontend page** — create `apps/admin/app/reports/page.tsx`:

```tsx
'use client';

import ProtectedLayout from '@/components/protected-layout';

export default function ReportsPage() {
  return (
    <ProtectedLayout>
      {/* your content */}
    </ProtectedLayout>
  );
}
```

Next.js auto-discovers the file — the route `/reports` is available immediately.

---

**2. Backend router** — create `apps/backend/src/routes/admin/reports.ts`:

```ts
import { Router } from 'express';

const router = Router();

router.get('/reports', async (_req, res, next) => {
  // ...
});

export default router;
```

---

**3. Register the router** — add to `apps/backend/src/routes/admin/index.ts`:

```ts
import reportsRouter from './reports';
// ...
router.use(reportsRouter);
```

---

**4. API client** — add to `apps/admin/lib/api.ts`:

```ts
export const reportsApi = {
  list: async () => {
    const response = await api.get('/admin/reports');
    return response.data;
  },
  // add create / update / delete as needed
};
```

---

**5. Navigation config** — add an entry to the `navigation` array in `apps/admin/lib/nav-config.ts`:

```ts
{
  name: 'Reports',
  href: '/reports',
  icon: ChartBarIcon,       // import from @heroicons/react/24/outline
  navKey: 'nav_visible_reports',
}
```

Place it inside whichever `group` fits, or create a new group. This single file drives both the sidebar and the Configure Menu UI.

---

**6. Backend menu key** — register the new `navKey` in `apps/backend/src/routes/admin/settings.ts`:

```ts
const NAV_KEYS = [
  // existing keys...
  'nav_visible_reports',
];
```

And add it to the Zod schema in `apps/backend/src/schemas/admin.ts`:

```ts
nav_visible_reports: z.boolean().optional(),
```

---

After these 6 steps the module has a route, a backend API, an API client, appears in the sidebar, and can be toggled on/off from **Settings → Configure Menu**.
