import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { mkdir } from 'fs/promises';
import logger from '../../utils/logger.js';

interface DatabaseConfig {
  path?: string;
}

type ContactStatus = 'new' | 'reviewed' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost' | 'archived';

interface Contact {
  id?: number;
  name: string;
  email: string;
  company?: string;
  project_type?: string;
  message: string;
  ip_address?: string;
  user_agent?: string;
  submitted_at?: string;
  is_test?: boolean;
  site_id?: number;
  country?: string;
  country_name?: string;
  city?: string;
  region?: string;
  status?: ContactStatus;
  follow_up_at?: string;
}

interface ContactNote {
  id?: number;
  contact_id: number;
  content: string;
  type: 'manual' | 'system';
  subtype?: 'note' | 'todo' | 'message' | 'reply';
  color?: string;
  is_done?: boolean;
  completed_at?: string;
  due_at?: string;
  created_at?: string;
}

interface WaitlistEntry {
  id?: number;
  email: string;
  name?: string;
  tags?: string;
  ip_address?: string;
  signed_up_at?: string;
  is_test?: boolean;
  site_id?: number;
  country?: string;
  country_name?: string;
  city?: string;
  region?: string;
}

interface MediaData {
  id?: number;
  filename: string;
  original_name: string;
  project_name?: string;
  description?: string;
  file_size: number;
  width?: number;
  height?: number;
  mime_type: string;
  storage_provider: string;
  storage_path: string;
  thumbnail_url?: string;
  uploaded_at?: string;
}

interface AdminLogData {
  action: string;
  resource: string;
  resource_id?: number;
  details?: string;
  ip_address?: string;
}

interface AdminLog {
  id: number;
  action: string;
  resource: string;
  resource_id?: number;
  details?: string;
  ip_address?: string;
  created_at: string;
}

interface Site {
  id?: number;
  name: string;
  domain?: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
}

interface Campaign {
  id?: number;
  name: string;
  subject: string;
  preheader?: string;
  html_content: string;
  text_content?: string;
  status: 'draft' | 'sent';
  target_type: 'all' | 'tagged';
  target_tags?: string;
  sent_count?: number;
  sent_at?: string;
  created_at?: string;
}

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

interface Invoice {
  id?: number;
  invoice_number: string;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount: number;
  total: number;
  notes?: string;
  due_date?: string;
  issued_date?: string;
  client_name?: string;
  client_email?: string;
  client_address?: string;
  company_name?: string;
  company_email?: string;
  company_address?: string;
  company_phone?: string;
  company_logo_url?: string;
  template: string;
  created_at?: string;
  updated_at?: string;
}

interface InvoiceItem {
  id?: number;
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

interface DatabaseResult {
  lastID: number;
  changes: number;
}

class SQLiteAdapter {
  private config: DatabaseConfig;
  private db: sqlite3.Database | null;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.db = null;
  }

  async initialize() {
    try {
      if (!this.config.path) {
        throw new Error('Database path is required');
      }
      
      // Ensure database directory exists
      const dbDir = path.dirname(this.config.path);
      await mkdir(dbDir, { recursive: true });

      // Create database connection
      await this.connect();
      
      // Run migrations
      await this.migrate();
      
      logger.info('SQLite database initialized');
    } catch (error) {
      logger.error({
        message: 'Failed to initialize SQLite',
        error: error
      });
      throw error;
    }
  }

  async connect(): Promise<void> {
    if (!this.config.path) {
      throw new Error('Database path is required');
    }
    
    return new Promise<void>((resolve, reject) => {
      this.db = new sqlite3.Database(this.config.path!, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          // Enable foreign keys
          this.db!.run('PRAGMA foreign_keys = ON');
          logger.info(`Connected to SQLite database: ${this.config.path}`);
          resolve();
        }
      });
    });
  }

  async migrate() {
    const migrations = [
      // Contacts table
      `CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        company VARCHAR(100),
        project_type VARCHAR(50),
        message TEXT,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        user_agent TEXT,
        is_test BOOLEAN DEFAULT 0
      )`,
      
      // Waitlist table
      `CREATE TABLE IF NOT EXISTS waitlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(100),
        signed_up_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(45),
        is_test BOOLEAN DEFAULT 0
      )`,
      
      // Portfolio media table
      `CREATE TABLE IF NOT EXISTS portfolio_media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255),
        project_name VARCHAR(100),
        description TEXT,
        file_size INTEGER,
        width INTEGER,
        height INTEGER,
        mime_type VARCHAR(50),
        storage_provider VARCHAR(20),
        storage_path VARCHAR(500),
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Admin logs table
      `CREATE TABLE IF NOT EXISTS admin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action VARCHAR(100),
        resource VARCHAR(100),
        resource_id INTEGER,
        details TEXT,
        ip_address VARCHAR(45),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Add test flag columns to existing tables (ignore if already exists)
      `ALTER TABLE contacts ADD COLUMN is_test BOOLEAN DEFAULT 0`,
      `ALTER TABLE waitlist ADD COLUMN is_test BOOLEAN DEFAULT 0`,
      
      // Settings table (runtime toggles)
      `CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Sites table (multi-site groundwork)
      `CREATE TABLE IF NOT EXISTS sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL,
        domain VARCHAR(255),
        description TEXT,
        api_key VARCHAR(64),
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Add api_key to existing sites installs (UNIQUE via separate index — SQLite ADD COLUMN forbids inline UNIQUE)
      `ALTER TABLE sites ADD COLUMN api_key VARCHAR(64)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_api_key ON sites(api_key)`,

      // Add site_id to contacts and waitlist (nullable, non-breaking)
      `ALTER TABLE contacts ADD COLUMN site_id INTEGER`,
      `ALTER TABLE waitlist ADD COLUMN site_id INTEGER`,

      // Geo columns for contacts
      `ALTER TABLE contacts ADD COLUMN country VARCHAR(2)`,
      `ALTER TABLE contacts ADD COLUMN country_name VARCHAR(100)`,
      `ALTER TABLE contacts ADD COLUMN city VARCHAR(100)`,
      `ALTER TABLE contacts ADD COLUMN region VARCHAR(100)`,

      // Geo columns for waitlist
      `ALTER TABLE waitlist ADD COLUMN country VARCHAR(2)`,
      `ALTER TABLE waitlist ADD COLUMN country_name VARCHAR(100)`,
      `ALTER TABLE waitlist ADD COLUMN city VARCHAR(100)`,
      `ALTER TABLE waitlist ADD COLUMN region VARCHAR(100)`,

      // Campaigns table
      `CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        preheader VARCHAR(255),
        html_content TEXT NOT NULL,
        text_content TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        sent_count INTEGER DEFAULT 0,
        sent_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Add status column to contacts
      `ALTER TABLE contacts ADD COLUMN status TEXT DEFAULT 'new'`,

      // Contact notes table
      `CREATE TABLE IF NOT EXISTS contact_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'manual',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_contact_notes_contact_id ON contact_notes(contact_id)`,

      // Add color column to contact_notes
      `ALTER TABLE contact_notes ADD COLUMN color TEXT`,

      // Add follow-up date to contacts
      `ALTER TABLE contacts ADD COLUMN follow_up_at DATETIME`,

      // Add subtype and is_done to contact_notes
      `ALTER TABLE contact_notes ADD COLUMN subtype TEXT DEFAULT 'note'`,
      `ALTER TABLE contact_notes ADD COLUMN is_done BOOLEAN DEFAULT 0`,

      // Track when contact last changed status (for Kanban column date)
      `ALTER TABLE contacts ADD COLUMN status_changed_at DATETIME`,

      // Invoices table
      `CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number VARCHAR(50) NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        currency VARCHAR(3) NOT NULL DEFAULT 'USD',
        subtotal REAL NOT NULL DEFAULT 0,
        tax_rate REAL NOT NULL DEFAULT 0,
        tax_amount REAL NOT NULL DEFAULT 0,
        discount REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        notes TEXT,
        due_date DATETIME,
        issued_date DATETIME,
        client_name VARCHAR(200),
        client_email VARCHAR(255),
        client_address TEXT,
        company_name VARCHAR(200),
        company_email VARCHAR(255),
        company_address TEXT,
        company_phone VARCHAR(50),
        company_logo_url VARCHAR(500),
        template VARCHAR(50) NOT NULL DEFAULT 'classic',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Invoice line items table
      `CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0,
        amount REAL NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id)`,

      // Tags column for waitlist (JSON array, e.g. '["newsletter","beta"]')
      `ALTER TABLE waitlist ADD COLUMN tags TEXT`,

      // Campaign targeting columns
      `ALTER TABLE campaigns ADD COLUMN target_type VARCHAR(20) NOT NULL DEFAULT 'all'`,
      `ALTER TABLE campaigns ADD COLUMN target_tags TEXT`,

      // Todo lifecycle columns
      `ALTER TABLE contact_notes ADD COLUMN completed_at DATETIME`,
      `ALTER TABLE contact_notes ADD COLUMN due_at DATETIME`,

      // Thumbnail URL for portfolio media (server-side generated)
      `ALTER TABLE portfolio_media ADD COLUMN thumbnail_url VARCHAR(500)`,

      // Create indexes
      `CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)`,
      `CREATE INDEX IF NOT EXISTS idx_contacts_submitted_at ON contacts(submitted_at)`,
      `CREATE INDEX IF NOT EXISTS idx_portfolio_media_project ON portfolio_media(project_name)`,
      `CREATE INDEX IF NOT EXISTS idx_contacts_site ON contacts(site_id)`,
      `CREATE INDEX IF NOT EXISTS idx_waitlist_site ON waitlist(site_id)`,
    ];

    if (!this.db) throw new Error('Database not connected');
    const runAsync = promisify(this.db.run.bind(this.db));
    
    for (const migration of migrations) {
      try {
        await runAsync(migration);
      } catch (error: unknown) {
        // For ADD COLUMN migrations, any SQLITE_ERROR means the column already
        // exists — the table is guaranteed to exist at this point (created above),
        // so there is no other SQLITE_ERROR that can occur for ADD COLUMN.
        const sqlErr = error as { code?: string };
        if (sqlErr.code === 'SQLITE_ERROR' &&
            migration.includes('ALTER TABLE') &&
            migration.includes('ADD COLUMN')) {
          logger.debug({
            message: `Column already exists, skipping: ${migration}`,
          });
          continue;
        }
        
        logger.error({
          message: `Migration failed: ${migration}`,
          error: error
        });
        throw error;
      }
    }
    
    logger.info('Database migrations completed');
  }

  async all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.db) throw new Error('Database not connected');
    const allAsync = promisify(this.db.all.bind(this.db)) as (sql: string, params?: unknown[]) => Promise<T[]>;
    return allAsync(sql, params);
  }

  async get<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    if (!this.db) throw new Error('Database not connected');
    const getAsync = promisify(this.db.get.bind(this.db)) as (sql: string, params?: unknown[]) => Promise<T | null>;
    return getAsync(sql, params);
  }

  async run(sql: string, params: unknown[] = []): Promise<DatabaseResult> {
    if (!this.db) throw new Error('Database not connected');
    
    return new Promise<DatabaseResult>((resolve, reject) => {
      this.db!.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
        if (err) {
          reject(err);
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes
          });
        }
      });
    });
  }

  async close(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.db) {
        this.db.close((err: Error | null) => {
          if (err) {
            reject(err);
          } else {
            logger.info('SQLite database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  // Model-like methods for easy access
  get contacts() {
    return {
      create: async (data: Contact): Promise<Contact> => {
        const sql = `INSERT INTO contacts (name, email, company, project_type, message, ip_address, user_agent, is_test, site_id, country, country_name, city, region)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [
          data.name,
          data.email,
          data.company || null,
          data.project_type || null,
          data.message,
          data.ip_address || null,
          data.user_agent || null,
          data.is_test || false,
          data.site_id || null,
          data.country || null,
          data.country_name || null,
          data.city || null,
          data.region || null,
        ];
        const result = await this.run(sql, params);
        return { id: result.lastID, ...data };
      },
      
      findAll: async (limit: number = 100, offset: number = 0): Promise<Contact[]> => {
        const sql = `SELECT * FROM contacts ORDER BY submitted_at DESC LIMIT ? OFFSET ?`;
        return this.all(sql, [limit, offset]);
      },
      
      findById: async (id: number): Promise<Contact | null> => {
        const sql = `SELECT * FROM contacts WHERE id = ?`;
        return this.get(sql, [id]);
      },
      
      deleteById: async (id: number): Promise<boolean> => {
        const sql = `DELETE FROM contacts WHERE id = ?`;
        const result = await this.run(sql, [id]);
        return result.changes > 0;
      },
      
      count: async (): Promise<number> => {
        const sql = `SELECT COUNT(*) as count FROM contacts`;
        const result = await this.get(sql, []);
        return (result as { count: number })?.count || 0;
      },

      dailyCounts: async (days: number = 30): Promise<{ date: string; count: number }[]> => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (days - 1));
        const dateStr = startDate.toISOString().split('T')[0];
        const sql = `SELECT date(submitted_at) as date, COUNT(*) as count
                     FROM contacts
                     WHERE date(submitted_at) >= ?
                     GROUP BY date(submitted_at)
                     ORDER BY date ASC`;
        return this.all(sql, [dateStr]);
      },

      deleteByIds: async (ids: number[]): Promise<number> => {
        if (ids.length === 0) return 0;
        const placeholders = ids.map(() => '?').join(',');
        const sql = `DELETE FROM contacts WHERE id IN (${placeholders})`;
        const result = await this.run(sql, ids);
        return result.changes;
      },

      updateById: async (
        id: number,
        data: Partial<Pick<Contact, 'name' | 'email' | 'company' | 'project_type' | 'message'>>,
      ): Promise<Contact | null> => {
        const keys = Object.keys(data);
        if (!keys.length) return this.get(`SELECT * FROM contacts WHERE id = ?`, [id]);
        const fields = keys.map(k => `${k} = ?`).join(', ');
        await this.run(`UPDATE contacts SET ${fields} WHERE id = ?`, [...Object.values(data), id]);
        return this.get(`SELECT * FROM contacts WHERE id = ?`, [id]);
      },

      updateStatus: async (id: number, status: ContactStatus): Promise<Contact | null> => {
        const now = new Date().toISOString();
        await this.run(`UPDATE contacts SET status = ?, status_changed_at = ? WHERE id = ?`, [status, now, id]);
        return this.get(`SELECT * FROM contacts WHERE id = ?`, [id]);
      },

      updateFollowUp: async (id: number, followUpAt: string | null): Promise<Contact | null> => {
        await this.run(`UPDATE contacts SET follow_up_at = ? WHERE id = ?`, [followUpAt, id]);
        return this.get(`SELECT * FROM contacts WHERE id = ?`, [id]);
      },
    };
  }

  get contactNotes() {
    return {
      create: async (data: Omit<ContactNote, 'id' | 'created_at'>): Promise<ContactNote> => {
        const sql = `INSERT INTO contact_notes (contact_id, content, type, color, subtype, is_done, due_at) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const result = await this.run(sql, [
          data.contact_id, data.content, data.type,
          data.color || null, data.subtype || 'note', data.is_done ? 1 : 0,
          data.due_at || null,
        ]);
        return { id: result.lastID, ...data };
      },

      findByContactId: async (contactId: number): Promise<ContactNote[]> => {
        const sql = `SELECT * FROM contact_notes WHERE contact_id = ? ORDER BY created_at ASC`;
        return this.all(sql, [contactId]);
      },

      findById: async (id: number): Promise<ContactNote | null> => {
        return this.get(`SELECT * FROM contact_notes WHERE id = ?`, [id]);
      },

      deleteById: async (id: number): Promise<boolean> => {
        const sql = `DELETE FROM contact_notes WHERE id = ? AND type = 'manual'`;
        const result = await this.run(sql, [id]);
        return result.changes > 0;
      },

      toggleDone: async (id: number): Promise<ContactNote | null> => {
        await this.run(
          `UPDATE contact_notes SET is_done = NOT is_done, completed_at = CASE WHEN is_done = 0 THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = ? AND subtype = 'todo'`,
          [id]
        );
        return this.get(`SELECT * FROM contact_notes WHERE id = ?`, [id]);
      },

      updateDueAt: async (id: number, dueAt: string | null): Promise<ContactNote | null> => {
        await this.run(`UPDATE contact_notes SET due_at = ? WHERE id = ? AND subtype = 'todo'`, [dueAt, id]);
        return this.get(`SELECT * FROM contact_notes WHERE id = ?`, [id]);
      },

      openTodosCount: async (): Promise<{ total: number; contacts: number }> => {
        const result = await this.get<{ total: number; contacts: number }>(
          `SELECT COUNT(*) as total, COUNT(DISTINCT contact_id) as contacts
           FROM contact_notes WHERE subtype = 'todo' AND is_done = 0 AND type = 'manual'`,
          []
        );
        return result || { total: 0, contacts: 0 };
      },

      openTodoContactIds: async (): Promise<number[]> => {
        const rows = await this.all<{ contact_id: number }>(
          `SELECT DISTINCT contact_id FROM contact_notes WHERE subtype = 'todo' AND is_done = 0 AND type = 'manual'`,
          []
        );
        return rows.map(r => r.contact_id);
      },

      findStatusChangesByContactIds: async (contactIds: number[]): Promise<{ contact_id: number; content: string; created_at: string }[]> => {
        if (contactIds.length === 0) return [];
        const placeholders = contactIds.map(() => '?').join(',');
        const sql = `SELECT contact_id, content, created_at FROM contact_notes
                     WHERE contact_id IN (${placeholders}) AND type = 'system' AND content LIKE 'Status changed:%'
                     ORDER BY created_at ASC`;
        return this.all(sql, contactIds);
      },

      findByDateRange: async (startDate: string, endDate: string): Promise<(ContactNote & { contact_name: string; contact_email: string; contact_status: string })[]> => {
        const sql = `SELECT cn.*, c.name as contact_name, c.email as contact_email, COALESCE(c.status, 'new') as contact_status
                     FROM contact_notes cn
                     JOIN contacts c ON c.id = cn.contact_id
                     WHERE date(cn.created_at) >= ? AND date(cn.created_at) <= ?
                     ORDER BY cn.created_at ASC`;
        return this.all(sql, [startDate, endDate]);
      },
    };
  }

  get waitlist() {
    return {
      create: async (data: WaitlistEntry): Promise<WaitlistEntry> => {
        const sql = `INSERT OR IGNORE INTO waitlist (email, name, ip_address, is_test, site_id, country, country_name, city, region)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [
          data.email,
          data.name || null,
          data.ip_address || null,
          data.is_test || false,
          data.site_id || null,
          data.country || null,
          data.country_name || null,
          data.city || null,
          data.region || null,
        ];
        const result = await this.run(sql, params);
        return { id: result.lastID, ...data };
      },
      
      findAll: async (limit: number = 100, offset: number = 0): Promise<WaitlistEntry[]> => {
        const sql = `SELECT * FROM waitlist ORDER BY signed_up_at DESC LIMIT ? OFFSET ?`;
        return this.all(sql, [limit, offset]);
      },
      
      findByEmail: async (email: string): Promise<WaitlistEntry | null> => {
        const sql = `SELECT * FROM waitlist WHERE email = ?`;
        return this.get(sql, [email]);
      },

      findById: async (id: number): Promise<WaitlistEntry | null> => {
        return this.get(`SELECT * FROM waitlist WHERE id = ?`, [id]);
      },

      updateById: async (
        id: number,
        data: Partial<Pick<WaitlistEntry, 'name' | 'email' | 'tags'>>,
      ): Promise<WaitlistEntry | null> => {
        const keys = Object.keys(data);
        if (!keys.length) return this.get(`SELECT * FROM waitlist WHERE id = ?`, [id]);
        const fields = keys.map(k => `${k} = ?`).join(', ');
        await this.run(`UPDATE waitlist SET ${fields} WHERE id = ?`, [...Object.values(data), id]);
        return this.get(`SELECT * FROM waitlist WHERE id = ?`, [id]);
      },

      count: async (): Promise<number> => {
        const sql = `SELECT COUNT(*) as count FROM waitlist`;
        const result = await this.get(sql, []);
        return (result as { count: number })?.count || 0;
      },

      dailyCounts: async (days: number = 30): Promise<{ date: string; count: number }[]> => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (days - 1));
        const dateStr = startDate.toISOString().split('T')[0];
        const sql = `SELECT date(signed_up_at) as date, COUNT(*) as count
                     FROM waitlist
                     WHERE date(signed_up_at) >= ?
                     GROUP BY date(signed_up_at)
                     ORDER BY date ASC`;
        return this.all(sql, [dateStr]);
      },

      deleteByIds: async (ids: number[]): Promise<number> => {
        if (ids.length === 0) return 0;
        const placeholders = ids.map(() => '?').join(',');
        const sql = `DELETE FROM waitlist WHERE id IN (${placeholders})`;
        const result = await this.run(sql, ids);
        return result.changes;
      },

      findAllActive: async (): Promise<WaitlistEntry[]> => {
        const sql = `SELECT * FROM waitlist WHERE is_test = 0 ORDER BY signed_up_at DESC`;
        return this.all(sql, []);
      },

      findActiveByTags: async (tags: string[]): Promise<WaitlistEntry[]> => {
        // Find subscribers whose tags JSON array contains ANY of the given tags
        const conditions = tags.map(() => `tags LIKE ?`).join(' OR ');
        const params = tags.map(t => `%"${t}"%`);
        const sql = `SELECT * FROM waitlist WHERE is_test = 0 AND (${conditions}) ORDER BY signed_up_at DESC`;
        return this.all(sql, params);
      },

      countByTarget: async (targetType: 'all' | 'tagged', tags?: string[]): Promise<number> => {
        if (targetType === 'all' || !tags || tags.length === 0) {
          const result = await this.get(`SELECT COUNT(*) as count FROM waitlist WHERE is_test = 0`, []);
          return (result as { count: number })?.count || 0;
        }
        const conditions = tags.map(() => `tags LIKE ?`).join(' OR ');
        const params = tags.map(t => `%"${t}"%`);
        const result = await this.get(`SELECT COUNT(*) as count FROM waitlist WHERE is_test = 0 AND (${conditions})`, params);
        return (result as { count: number })?.count || 0;
      },

      getAllTags: async (): Promise<string[]> => {
        const rows = await this.all(`SELECT DISTINCT tags FROM waitlist WHERE tags IS NOT NULL AND tags != '' AND tags != '[]'`, []);
        const tagSet = new Set<string>();
        for (const row of rows) {
          try {
            const parsed = JSON.parse((row as { tags: string }).tags);
            if (Array.isArray(parsed)) {
              for (const t of parsed) if (typeof t === 'string' && t.trim()) tagSet.add(t.trim());
            }
          } catch { /* skip malformed */ }
        }
        return Array.from(tagSet).sort();
      },
    };
  }

  get media() {
    return {
      create: async (data: MediaData): Promise<MediaData> => {
        const sql = `INSERT INTO portfolio_media
                     (filename, original_name, project_name, description, file_size, width, height, mime_type, storage_provider, storage_path, thumbnail_url)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [
          data.filename,
          data.original_name,
          data.project_name || null,
          data.description || null,
          data.file_size,
          data.width || null,
          data.height || null,
          data.mime_type,
          data.storage_provider,
          data.storage_path,
          data.thumbnail_url || null,
        ];
        const result = await this.run(sql, params);
        return { id: result.lastID, ...data };
      },
      
      findAll: async (limit: number = 50, offset: number = 0): Promise<MediaData[]> => {
        const sql = `SELECT * FROM portfolio_media ORDER BY uploaded_at DESC LIMIT ? OFFSET ?`;
        return this.all(sql, [limit, offset]);
      },
      
      findById: async (id: number): Promise<MediaData | null> => {
        const sql = `SELECT * FROM portfolio_media WHERE id = ?`;
        return this.get(sql, [id]);
      },
      
      updateById: async (id: number, data: Partial<MediaData>): Promise<boolean> => {
        const fields: string[] = [];
        const values: unknown[] = [];
        
        if (data.filename !== undefined) {
          fields.push('filename = ?');
          values.push(data.filename);
        }
        if (data.original_name !== undefined) {
          fields.push('original_name = ?');
          values.push(data.original_name);
        }
        if (data.storage_path !== undefined) {
          fields.push('storage_path = ?');
          values.push(data.storage_path);
        }
        if (data.project_name !== undefined) {
          fields.push('project_name = ?');
          values.push(data.project_name);
        }
        if (data.description !== undefined) {
          fields.push('description = ?');
          values.push(data.description);
        }
        if (data.thumbnail_url !== undefined) {
          fields.push('thumbnail_url = ?');
          values.push(data.thumbnail_url);
        }

        if (fields.length === 0) return false;
        
        values.push(id);
        const sql = `UPDATE portfolio_media SET ${fields.join(', ')} WHERE id = ?`;
        const result = await this.run(sql, values);
        return result.changes > 0;
      },
      
      deleteById: async (id: number): Promise<boolean> => {
        const sql = `DELETE FROM portfolio_media WHERE id = ?`;
        const result = await this.run(sql, [id]);
        return result.changes > 0;
      },
      
      count: async (): Promise<number> => {
        const sql = `SELECT COUNT(*) as count FROM portfolio_media`;
        const result = await this.get(sql, []);
        return (result as { count: number })?.count || 0;
      },
    };
  }

  get adminLogs() {
    return {
      create: async (data: AdminLogData): Promise<void> => {
        const sql = `INSERT INTO admin_logs (action, resource, resource_id, details, ip_address)
                     VALUES (?, ?, ?, ?, ?)`;
        const params = [
          data.action,
          data.resource,
          data.resource_id || null,
          data.details || null,
          data.ip_address || null,
        ];
        await this.run(sql, params);
      },

      findAll: async (limit: number = 50, offset: number = 0): Promise<AdminLog[]> => {
        const sql = `SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        return this.all(sql, [limit, offset]);
      },

      count: async (): Promise<number> => {
        const sql = `SELECT COUNT(*) as count FROM admin_logs`;
        const result = await this.get(sql, []);
        return (result as { count: number })?.count || 0;
      },

      deleteById: async (id: number): Promise<boolean> => {
        const sql = `DELETE FROM admin_logs WHERE id = ?`;
        const result = await this.run(sql, [id]);
        return result.changes > 0;
      },

      deleteAll: async (): Promise<number> => {
        const sql = `DELETE FROM admin_logs`;
        const result = await this.run(sql, []);
        return result.changes;
      },
    };
  }

  get settings() {
    return {
      get: async (key: string): Promise<string | null> => {
        const sql = `SELECT value FROM settings WHERE key = ?`;
        const result = await this.get<{ value: string }>(sql, [key]);
        return result?.value ?? null;
      },

      set: async (key: string, value: string): Promise<void> => {
        const sql = `INSERT OR REPLACE INTO settings (key, value, updated_at)
                     VALUES (?, ?, CURRENT_TIMESTAMP)`;
        await this.run(sql, [key, value]);
      },

      getAll: async (): Promise<Record<string, string>> => {
        const sql = `SELECT key, value FROM settings`;
        const rows = await this.all<{ key: string; value: string }>(sql, []);
        return Object.fromEntries(rows.map(r => [r.key, r.value]));
      },
    };
  }

  get sites() {
    return {
      create: async (data: Omit<Site, 'id' | 'created_at'> & { api_key: string }): Promise<Site & { api_key: string }> => {
        const sql = `INSERT INTO sites (name, domain, description, api_key, is_active) VALUES (?, ?, ?, ?, ?)`;
        const result = await this.run(sql, [data.name, data.domain || null, data.description || null, data.api_key, data.is_active ?? 1]);
        return { id: result.lastID, ...data };
      },

      findAll: async (): Promise<(Site & { api_key: string })[]> => {
        const sql = `SELECT * FROM sites ORDER BY created_at DESC`;
        return this.all(sql, []);
      },

      findById: async (id: number): Promise<(Site & { api_key: string }) | null> => {
        const sql = `SELECT * FROM sites WHERE id = ?`;
        return this.get(sql, [id]);
      },

      findByKey: async (key: string): Promise<(Site & { api_key: string }) | null> => {
        const sql = `SELECT * FROM sites WHERE api_key = ? AND is_active = 1`;
        return this.get(sql, [key]);
      },

      updateApiKey: async (id: number, apiKey: string): Promise<boolean> => {
        const sql = `UPDATE sites SET api_key = ? WHERE id = ?`;
        const result = await this.run(sql, [apiKey, id]);
        return result.changes > 0;
      },

      toggleActive: async (id: number, isActive: boolean): Promise<boolean> => {
        const sql = `UPDATE sites SET is_active = ? WHERE id = ?`;
        const result = await this.run(sql, [isActive ? 1 : 0, id]);
        return result.changes > 0;
      },

      deleteById: async (id: number): Promise<boolean> => {
        const sql = `DELETE FROM sites WHERE id = ?`;
        const result = await this.run(sql, [id]);
        return result.changes > 0;
      },
    };
  }
  get campaigns() {
    return {
      create: async (data: Omit<Campaign, 'id' | 'created_at' | 'sent_at' | 'sent_count'>): Promise<Campaign> => {
        const sql = `INSERT INTO campaigns (name, subject, preheader, html_content, text_content, status, target_type, target_tags)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [
          data.name,
          data.subject,
          data.preheader || null,
          data.html_content,
          data.text_content || null,
          data.status,
          data.target_type || 'all',
          data.target_tags || null,
        ];
        const result = await this.run(sql, params);
        return { id: result.lastID, ...data };
      },

      findAll: async (limit: number = 100, offset: number = 0): Promise<Campaign[]> => {
        const sql = `SELECT * FROM campaigns ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        return this.all(sql, [limit, offset]);
      },

      findById: async (id: number): Promise<Campaign | null> => {
        const sql = `SELECT * FROM campaigns WHERE id = ?`;
        return this.get(sql, [id]);
      },

      updateById: async (id: number, data: Record<string, string | undefined>): Promise<Campaign | null> => {
        const keys = Object.keys(data).filter(k => data[k] !== undefined);
        if (!keys.length) return this.get(`SELECT * FROM campaigns WHERE id = ?`, [id]);
        const fields = keys.map(k => `${k} = ?`).join(', ');
        await this.run(`UPDATE campaigns SET ${fields} WHERE id = ?`, [...keys.map(k => data[k]), id]);
        return this.get(`SELECT * FROM campaigns WHERE id = ?`, [id]);
      },

      deleteById: async (id: number): Promise<boolean> => {
        const sql = `DELETE FROM campaigns WHERE id = ? AND status = 'draft'`;
        const result = await this.run(sql, [id]);
        return result.changes > 0;
      },

      count: async (): Promise<number> => {
        const sql = `SELECT COUNT(*) as count FROM campaigns`;
        const result = await this.get(sql, []);
        return (result as { count: number })?.count || 0;
      },

      markSent: async (id: number, sentCount: number): Promise<Campaign | null> => {
        const sql = `UPDATE campaigns SET status = 'sent', sent_count = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?`;
        await this.run(sql, [sentCount, id]);
        return this.get(`SELECT * FROM campaigns WHERE id = ?`, [id]);
      },
    };
  }

  get invoices() {
    return {
      create: async (data: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>): Promise<Invoice> => {
        const sql = `INSERT INTO invoices (invoice_number, status, currency, subtotal, tax_rate, tax_amount, discount, total, notes, due_date, issued_date, client_name, client_email, client_address, company_name, company_email, company_address, company_phone, company_logo_url, template)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [
          data.invoice_number, data.status, data.currency,
          data.subtotal, data.tax_rate, data.tax_amount, data.discount, data.total,
          data.notes || null, data.due_date || null, data.issued_date || null,
          data.client_name || null, data.client_email || null, data.client_address || null,
          data.company_name || null, data.company_email || null, data.company_address || null,
          data.company_phone || null, data.company_logo_url || null, data.template,
        ];
        const result = await this.run(sql, params);
        return { id: result.lastID, ...data };
      },

      findAll: async (limit: number = 50, offset: number = 0, status?: string): Promise<Invoice[]> => {
        let sql = `SELECT * FROM invoices`;
        const params: unknown[] = [];
        if (status) {
          sql += ` WHERE status = ?`;
          params.push(status);
        }
        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        return this.all(sql, params);
      },

      findById: async (id: number): Promise<Invoice | null> => {
        return this.get(`SELECT * FROM invoices WHERE id = ?`, [id]);
      },

      updateById: async (id: number, data: Partial<Invoice>): Promise<Invoice | null> => {
        const allowed = [
          'invoice_number', 'status', 'currency', 'subtotal', 'tax_rate',
          'tax_amount', 'discount', 'total', 'notes', 'due_date', 'issued_date',
          'client_name', 'client_email', 'client_address',
          'company_name', 'company_email', 'company_address', 'company_phone',
          'company_logo_url', 'template',
        ];
        const keys = Object.keys(data).filter(k => allowed.includes(k));
        if (!keys.length) return this.get(`SELECT * FROM invoices WHERE id = ?`, [id]);
        const fields = [...keys.map(k => `${k} = ?`), 'updated_at = CURRENT_TIMESTAMP'].join(', ');
        const values = keys.map(k => (data as Record<string, unknown>)[k]);
        await this.run(`UPDATE invoices SET ${fields} WHERE id = ?`, [...values, id]);
        return this.get(`SELECT * FROM invoices WHERE id = ?`, [id]);
      },

      deleteById: async (id: number): Promise<boolean> => {
        const result = await this.run(`DELETE FROM invoices WHERE id = ?`, [id]);
        return result.changes > 0;
      },

      count: async (status?: string): Promise<number> => {
        let sql = `SELECT COUNT(*) as count FROM invoices`;
        const params: unknown[] = [];
        if (status) {
          sql += ` WHERE status = ?`;
          params.push(status);
        }
        const result = await this.get(sql, params);
        return (result as { count: number })?.count || 0;
      },

      nextNumber: async (): Promise<string> => {
        const result = await this.get<{ max_num: number | null }>(
          `SELECT MAX(CAST(REPLACE(invoice_number, 'INV-', '') AS INTEGER)) as max_num FROM invoices WHERE invoice_number LIKE 'INV-%'`,
          []
        );
        const next = (result?.max_num || 0) + 1;
        return `INV-${String(next).padStart(4, '0')}`;
      },
    };
  }

  get invoiceItems() {
    return {
      createMany: async (invoiceId: number, items: Omit<InvoiceItem, 'id' | 'invoice_id'>[]): Promise<void> => {
        for (const item of items) {
          await this.run(
            `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount) VALUES (?, ?, ?, ?, ?)`,
            [invoiceId, item.description, item.quantity, item.unit_price, item.amount]
          );
        }
      },

      findByInvoiceId: async (invoiceId: number): Promise<InvoiceItem[]> => {
        return this.all(`SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC`, [invoiceId]);
      },

      deleteByInvoiceId: async (invoiceId: number): Promise<void> => {
        await this.run(`DELETE FROM invoice_items WHERE invoice_id = ?`, [invoiceId]);
      },
    };
  }
}

export default SQLiteAdapter;