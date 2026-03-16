# Database Schema

```sql
CREATE TABLE contacts (
  id                INTEGER PRIMARY KEY,
  name              VARCHAR(100),
  email             VARCHAR(255),
  company           VARCHAR(100),
  project_type      VARCHAR(50),
  message           TEXT,
  status            VARCHAR(50) DEFAULT 'new',
  follow_up_at      TIMESTAMP,
  status_changed_at TIMESTAMP,
  submitted_at      TIMESTAMP,
  ip_address        VARCHAR(45),
  user_agent        TEXT,
  country           VARCHAR(100),
  city              VARCHAR(100),
  region            VARCHAR(100),
  is_test           BOOLEAN DEFAULT 0,
  site_id           INTEGER REFERENCES sites(id)
);

CREATE TABLE contact_notes (
  id          INTEGER PRIMARY KEY,
  contact_id  INTEGER REFERENCES contacts(id),
  content     TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP
);

CREATE TABLE waitlist (
  id           INTEGER PRIMARY KEY,
  email        VARCHAR(255) UNIQUE,
  name         VARCHAR(100),
  tags         TEXT,
  signed_up_at TIMESTAMP,
  ip_address   VARCHAR(45),
  country      VARCHAR(100),
  city         VARCHAR(100),
  region       VARCHAR(100),
  is_test      BOOLEAN DEFAULT 0,
  site_id      INTEGER REFERENCES sites(id)
);

CREATE TABLE campaigns (
  id             INTEGER PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  subject        VARCHAR(255),
  body           TEXT,
  status         VARCHAR(50) DEFAULT 'draft',
  target_tags    TEXT,
  recipient_count INTEGER DEFAULT 0,
  sent_at        TIMESTAMP,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invoices (
  id             INTEGER PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE,
  client_name    VARCHAR(255),
  client_email   VARCHAR(255),
  status         VARCHAR(50) DEFAULT 'draft',
  currency       VARCHAR(10) DEFAULT 'USD',
  subtotal       DECIMAL(10,2),
  tax_rate       DECIMAL(5,2),
  discount       DECIMAL(10,2),
  total          DECIMAL(10,2),
  notes          TEXT,
  due_date       DATE,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP
);

CREATE TABLE invoice_items (
  id          INTEGER PRIMARY KEY,
  invoice_id  INTEGER REFERENCES invoices(id),
  description VARCHAR(255),
  quantity    DECIMAL(10,2),
  unit_price  DECIMAL(10,2),
  total       DECIMAL(10,2)
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
  thumbnail_url    VARCHAR(500),
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
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMP
);

CREATE TABLE sites (
  id          INTEGER PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  domain      VARCHAR(255),
  description TEXT,
  api_key     VARCHAR(64) UNIQUE,
  is_active   BOOLEAN DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
