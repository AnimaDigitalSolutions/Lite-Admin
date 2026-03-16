# API Documentation

## Health

```http
GET /health
```

## Public Endpoints

### Contact Form Submission

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

### Waitlist Signup

```http
POST /api/forms/waitlist
Content-Type: application/json
X-Site-Key: lsk_...   (optional)

{
  "email": "user@example.com",
  "name": "Jane Doe"
}
```

### Portfolio Media

```http
GET /api/media/portfolio?limit=50&offset=0&project=MY_PROJECT
GET /api/media/:id
GET /api/media/:id/thumb?width=300&height=300&quality=85
```

## Admin Endpoints

All admin endpoints require a JWT token:

```http
Authorization: Bearer your-jwt-token
```

### Authentication

```http
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

### Contacts

```http
GET    /api/admin/submissions
DELETE /api/admin/submission/:id
POST   /api/admin/submissions/bulk-delete   { "ids": [1, 2, 3] }
```

### Contact Status & Notes

```http
PUT    /api/admin/contacts/:id/status       { "status": "qualified" }
GET    /api/admin/contacts/:id/notes
POST   /api/admin/contacts/:id/notes        { "content": "..." }
PUT    /api/admin/contacts/:id/notes/:noteId
DELETE /api/admin/contacts/:id/notes/:noteId
```

### Email Compose

```http
POST /api/admin/email/compose               { "to": [...], "subject": "...", "body": "..." }
```

### Email Credentials

```http
GET /api/admin/email/credentials
PUT /api/admin/email/credentials
POST /api/admin/email/credentials/verify
```

### Email Templates

```http
GET    /api/admin/email/templates
PUT    /api/admin/email/templates            { "type": "contact", "subject": "...", "body": "..." }
POST   /api/admin/email/templates/reset      { "type": "contact" }
```

### Campaigns

```http
GET    /api/admin/campaigns
POST   /api/admin/campaigns                  { "name": "...", "subject": "...", "body": "..." }
PUT    /api/admin/campaigns/:id
DELETE /api/admin/campaigns/:id
POST   /api/admin/campaigns/:id/send
```

### Invoices

```http
GET    /api/admin/invoices
POST   /api/admin/invoices                   { "client_name": "...", "items": [...] }
GET    /api/admin/invoices/:id
PUT    /api/admin/invoices/:id
DELETE /api/admin/invoices/:id
```

### Subscribers (Waitlist)

```http
GET    /api/admin/waitlist
GET    /api/admin/waitlist/count
GET    /api/admin/waitlist/export
POST   /api/admin/waitlist/bulk-delete       { "ids": [1, 2, 3] }
POST   /api/admin/waitlist/preview           { "tags": ["beta"] }
```

### Media Management

```http
POST   /api/admin/media/upload
PUT    /api/admin/media/:id
DELETE /api/admin/media/:id
```

### Settings & Credentials

```http
GET /api/admin/settings
PUT /api/admin/settings         { "key": "maintenance_mode", "value": "true" }

GET /api/admin/credentials
PUT /api/admin/credentials      { "email_ahasend_api_key": "...", ... }
```

Available setting keys: `email_enabled`, `maintenance_mode`, `maintenance_message`

### Activity Log

```http
GET    /api/admin/logs?limit=50&offset=0
DELETE /api/admin/logs/:id
DELETE /api/admin/logs          (clear all)
```

### Sites (Multi-Site API Keys)

```http
GET    /api/admin/sites
POST   /api/admin/sites                     { "name": "My Site" }
POST   /api/admin/sites/:id/regenerate      (rotate API key)
PATCH  /api/admin/sites/:id                 { "active": false }
DELETE /api/admin/sites/:id
```

### System

```http
POST /api/admin/migrate
GET  /api/admin/stats
```
