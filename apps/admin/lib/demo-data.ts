import type { AdminUser } from '@lite/shared';

export const DEMO_USER: AdminUser = {
  id: 1,
  email: 'demo@liteadmin.dev',
  name: 'Demo User',
  role: 'admin',
  createdAt: new Date('2025-01-15'),
  updatedAt: new Date('2026-03-10'),
  lastLoginAt: new Date(),
};

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function dateStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function futureDateStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// Generate trend data for charts
function makeTrend(days: number, base: number, variance: number) {
  const points = [];
  for (let i = days - 1; i >= 0; i--) {
    points.push({ date: dateStr(i), count: Math.max(0, base + Math.floor(Math.random() * variance * 2 - variance)) });
  }
  return points;
}

const CONTACTS = [
  { id: '1', name: 'Sarah Chen', email: 'sarah@designstudio.co', company: 'Design Studio Co', project_type: 'web', message: 'Looking for a modern portfolio redesign with CMS integration.', status: 'new', submitted_at: daysAgo(1), ip_address: '203.0.113.42', country: 'US', country_name: 'United States', city: 'San Francisco', region: 'California' },
  { id: '2', name: 'Marcus Williams', email: 'marcus@techventures.io', company: 'Tech Ventures', project_type: 'mobile', message: 'Need a cross-platform mobile app for our fintech startup.', status: 'contacted', submitted_at: daysAgo(3), ip_address: '198.51.100.15', country: 'US', country_name: 'United States', city: 'New York', region: 'New York' },
  { id: '3', name: 'Elena Rodriguez', email: 'elena@brightpath.edu', company: 'BrightPath Academy', project_type: 'web', message: 'We need an LMS platform for our online courses.', status: 'qualified', submitted_at: daysAgo(5), ip_address: '192.0.2.88', country: 'ES', country_name: 'Spain', city: 'Madrid', region: 'Madrid' },
  { id: '4', name: 'James O\'Brien', email: 'james@greenleaf.com', company: 'GreenLeaf Organics', project_type: 'erp', message: 'Inventory management system for our organic produce supply chain.', status: 'proposal_sent', submitted_at: daysAgo(7), ip_address: '203.0.113.100', country: 'IE', country_name: 'Ireland', city: 'Dublin', region: 'Leinster' },
  { id: '5', name: 'Aiko Tanaka', email: 'aiko@nexus.jp', company: 'Nexus Digital', project_type: 'consulting', message: 'Architecture review for our microservices migration.', status: 'won', submitted_at: daysAgo(12), ip_address: '198.51.100.200', country: 'JP', country_name: 'Japan', city: 'Tokyo', region: 'Tokyo' },
  { id: '6', name: 'David Park', email: 'david@sparkui.dev', company: 'Spark UI', project_type: 'web', message: 'Component library and design system for our SaaS product.', status: 'reviewed', submitted_at: daysAgo(2), ip_address: '192.0.2.55', country: 'KR', country_name: 'South Korea', city: 'Seoul', region: 'Seoul' },
  { id: '7', name: 'Lina Müller', email: 'lina@autohaus.de', company: 'AutoHaus Digital', project_type: 'web', message: 'E-commerce platform for automotive parts with configurator.', status: 'new', submitted_at: daysAgo(0), ip_address: '203.0.113.77', country: 'DE', country_name: 'Germany', city: 'Berlin', region: 'Berlin' },
  { id: '8', name: 'Raj Patel', email: 'raj@cloudnine.in', company: 'CloudNine Solutions', project_type: 'consulting', message: 'AWS infrastructure audit and cost optimization.', status: 'lost', submitted_at: daysAgo(20), ip_address: '198.51.100.33', country: 'IN', country_name: 'India', city: 'Mumbai', region: 'Maharashtra' },
  { id: '9', name: 'Olivia Foster', email: 'olivia@freshbrand.co', company: 'Fresh Brand Agency', project_type: 'web', message: 'Landing pages for our Q2 campaign launch.', status: 'contacted', submitted_at: daysAgo(4), ip_address: '192.0.2.12', country: 'AU', country_name: 'Australia', city: 'Sydney', region: 'New South Wales' },
  { id: '10', name: 'Noah Bergström', email: 'noah@nordictech.se', company: 'Nordic Tech AB', project_type: 'mobile', message: 'IoT dashboard app for our smart home devices.', status: 'qualified', submitted_at: daysAgo(6), ip_address: '203.0.113.150', country: 'SE', country_name: 'Sweden', city: 'Stockholm', region: 'Stockholm' },
];

const SUBSCRIBERS = [
  { id: '1', email: 'alex@startup.io', name: 'Alex Rivera', tags: '["early-access","beta"]', signed_up_at: daysAgo(30), country: 'US', country_name: 'United States', city: 'Austin', region: 'Texas' },
  { id: '2', email: 'maria@designlab.com', name: 'Maria Santos', tags: '["newsletter"]', signed_up_at: daysAgo(25), country: 'BR', country_name: 'Brazil', city: 'São Paulo', region: 'São Paulo' },
  { id: '3', email: 'chen.wei@mail.cn', name: 'Wei Chen', tags: '["early-access"]', signed_up_at: daysAgo(20), country: 'CN', country_name: 'China', city: 'Shanghai', region: 'Shanghai' },
  { id: '4', email: 'emma@creative.co.uk', name: 'Emma Thompson', tags: '["newsletter","updates"]', signed_up_at: daysAgo(15), country: 'GB', country_name: 'United Kingdom', city: 'London', region: 'England' },
  { id: '5', email: 'yuki@devtools.jp', name: 'Yuki Sato', tags: '["beta"]', signed_up_at: daysAgo(10), country: 'JP', country_name: 'Japan', city: 'Osaka', region: 'Osaka' },
  { id: '6', email: 'lucas@agency.fr', name: 'Lucas Martin', tags: '["newsletter"]', signed_up_at: daysAgo(5), country: 'FR', country_name: 'France', city: 'Paris', region: 'Île-de-France' },
  { id: '7', email: 'sofia@techmed.it', name: 'Sofia Russo', tags: '["early-access","newsletter"]', signed_up_at: daysAgo(3), country: 'IT', country_name: 'Italy', city: 'Milan', region: 'Lombardy' },
  { id: '8', email: 'omar@fintech.ae', name: 'Omar Hassan', tags: '["updates"]', signed_up_at: daysAgo(1), country: 'AE', country_name: 'UAE', city: 'Dubai', region: 'Dubai' },
];

const MEDIA_ITEMS = [
  { id: '1', filename: 'hero-banner.jpg', original_name: 'hero-banner.jpg', project_name: 'Portfolio', description: 'Main hero section background', file_size: 2450000, width: 1920, height: 1080, mime_type: 'image/jpeg', storage_path: '/uploads/hero-banner.jpg', uploaded_at: daysAgo(15), url: 'https://picsum.photos/seed/hero/1920/1080' },
  { id: '2', filename: 'team-photo.jpg', original_name: 'team-photo.jpg', project_name: 'About', description: 'Team group photo', file_size: 1800000, width: 1200, height: 800, mime_type: 'image/jpeg', storage_path: '/uploads/team-photo.jpg', uploaded_at: daysAgo(12), url: 'https://picsum.photos/seed/team/1200/800' },
  { id: '3', filename: 'product-mockup.png', original_name: 'product-mockup.png', project_name: 'Portfolio', description: 'SaaS dashboard mockup', file_size: 3200000, width: 1600, height: 900, mime_type: 'image/png', storage_path: '/uploads/product-mockup.png', uploaded_at: daysAgo(10), url: 'https://picsum.photos/seed/product/1600/900' },
  { id: '4', filename: 'logo-dark.svg', original_name: 'logo-dark.svg', project_name: 'Branding', description: 'Dark variant of the company logo', file_size: 15000, mime_type: 'image/svg+xml', storage_path: '/uploads/logo-dark.svg', uploaded_at: daysAgo(8), url: 'https://picsum.photos/seed/logo/400/400' },
  { id: '5', filename: 'case-study-cover.jpg', original_name: 'case-study-cover.jpg', project_name: 'Portfolio', description: 'Featured case study header image', file_size: 1950000, width: 1400, height: 700, mime_type: 'image/jpeg', storage_path: '/uploads/case-study-cover.jpg', uploaded_at: daysAgo(5), url: 'https://picsum.photos/seed/casestudy/1400/700' },
  { id: '6', filename: 'testimonial-bg.jpg', original_name: 'testimonial-bg.jpg', project_name: 'Portfolio', description: 'Background for testimonials section', file_size: 1100000, width: 1920, height: 600, mime_type: 'image/jpeg', storage_path: '/uploads/testimonial-bg.jpg', uploaded_at: daysAgo(3), url: 'https://picsum.photos/seed/testimonial/1920/600' },
  { id: '7', filename: 'proposal-template.pdf', original_name: 'proposal-template.pdf', project_name: 'Documents', description: 'Client proposal template', file_size: 450000, mime_type: 'application/pdf', storage_path: '/uploads/proposal-template.pdf', uploaded_at: daysAgo(1), url: '/uploads/proposal-template.pdf' },
];

const INVOICES = [
  { id: 1, invoice_number: 'INV-2026-001', status: 'paid', currency: 'USD', issued_date: dateStr(45), due_date: dateStr(15), client_name: 'Nexus Digital', client_email: 'aiko@nexus.jp', client_address: 'Tokyo, Japan', company_name: 'Anima Digital', company_email: 'hello@anima.dev', company_address: '123 Creative Blvd', company_phone: '+1 555-0100', company_logo_url: '', template: 'classic', tax_rate: 10, discount: 0, notes: 'Thank you for your business!', subtotal: 4500, tax_amount: 450, total: 4950, items: [{ description: 'Website Development', quantity: 1, unit_price: 3000, amount: 3000 }, { description: 'UI/UX Design', quantity: 1, unit_price: 1500, amount: 1500 }] },
  { id: 2, invoice_number: 'INV-2026-002', status: 'sent', currency: 'USD', issued_date: dateStr(10), due_date: futureDateStr(20), client_name: 'GreenLeaf Organics', client_email: 'james@greenleaf.com', client_address: 'Dublin, Ireland', company_name: 'Anima Digital', company_email: 'hello@anima.dev', company_address: '123 Creative Blvd', company_phone: '+1 555-0100', company_logo_url: '', template: 'modern', tax_rate: 15, discount: 200, notes: 'Net 30', subtotal: 8000, tax_amount: 1200, total: 9000, items: [{ description: 'ERP System Phase 1', quantity: 1, unit_price: 5000, amount: 5000 }, { description: 'Database Design', quantity: 1, unit_price: 3000, amount: 3000 }] },
  { id: 3, invoice_number: 'INV-2026-003', status: 'draft', currency: 'EUR', issued_date: dateStr(2), due_date: futureDateStr(28), client_name: 'AutoHaus Digital', client_email: 'lina@autohaus.de', client_address: 'Berlin, Germany', company_name: 'Anima Digital', company_email: 'hello@anima.dev', company_address: '123 Creative Blvd', company_phone: '+1 555-0100', company_logo_url: '', template: 'classic', tax_rate: 19, discount: 0, notes: '', subtotal: 12000, tax_amount: 2280, total: 14280, items: [{ description: 'E-commerce Platform', quantity: 1, unit_price: 8000, amount: 8000 }, { description: 'Product Configurator', quantity: 1, unit_price: 4000, amount: 4000 }] },
  { id: 4, invoice_number: 'INV-2026-004', status: 'overdue', currency: 'USD', issued_date: dateStr(60), due_date: dateStr(30), client_name: 'CloudNine Solutions', client_email: 'raj@cloudnine.in', client_address: 'Mumbai, India', company_name: 'Anima Digital', company_email: 'hello@anima.dev', company_address: '123 Creative Blvd', company_phone: '+1 555-0100', company_logo_url: '', template: 'minimal', tax_rate: 0, discount: 0, notes: 'OVERDUE — please remit payment', subtotal: 2500, tax_amount: 0, total: 2500, items: [{ description: 'AWS Infrastructure Audit', quantity: 1, unit_price: 2500, amount: 2500 }] },
];

const CAMPAIGNS = [
  { id: 1, name: 'Product Launch', subject: 'Introducing our new platform', status: 'sent', target_type: 'all', sent_at: daysAgo(10), total_recipients: 156, delivered: 152, opened: 89, clicked: 34, created_at: daysAgo(14) },
  { id: 2, name: 'Monthly Newsletter — March', subject: 'What\'s new in March 2026', status: 'draft', target_type: 'tagged', target_tags: ['newsletter'], created_at: daysAgo(2) },
  { id: 3, name: 'Beta Access Invite', subject: 'You\'re invited to try our beta', status: 'sent', target_type: 'tagged', target_tags: ['beta', 'early-access'], sent_at: daysAgo(20), total_recipients: 45, delivered: 44, opened: 38, clicked: 22, created_at: daysAgo(25) },
];

const LOGS = [
  { id: 1, action: 'login', details: 'Admin login successful', ip_address: '192.168.1.10', created_at: daysAgo(0) },
  { id: 2, action: 'media.upload', details: 'Uploaded proposal-template.pdf', ip_address: '192.168.1.10', created_at: daysAgo(1) },
  { id: 3, action: 'submission.status', details: 'Changed contact #2 status to contacted', ip_address: '192.168.1.10', created_at: daysAgo(3) },
  { id: 4, action: 'invoice.create', details: 'Created invoice INV-2026-003', ip_address: '192.168.1.10', created_at: daysAgo(2) },
  { id: 5, action: 'campaign.send', details: 'Sent campaign "Product Launch" to 156 recipients', ip_address: '192.168.1.10', created_at: daysAgo(10) },
  { id: 6, action: 'settings.update', details: 'Updated email settings', ip_address: '192.168.1.10', created_at: daysAgo(5) },
  { id: 7, action: 'waitlist.export', details: 'Exported 8 subscribers to CSV', ip_address: '192.168.1.10', created_at: daysAgo(7) },
];

// URL pattern matcher for demo responses
type DemoHandler = (url: string, params?: Record<string, string>) => unknown;

const demoRoutes: [RegExp, DemoHandler][] = [
  // Auth
  [/\/auth\/me$/, () => ({ data: { user: DEMO_USER } })],
  [/\/auth\/login$/, () => ({ data: { user: DEMO_USER, accessToken: 'demo', refreshToken: 'demo' } })],
  [/\/auth\/logout$/, () => ({ success: true })],
  [/\/auth\/refresh$/, () => ({ data: { accessToken: 'demo', refreshToken: 'demo' } })],
  [/\/auth\/change-password$/, () => ({ success: true })],

  // Stats
  [/\/admin\/stats/, () => ({
    data: {
      contacts: { total: CONTACTS.length, recent: CONTACTS[0].submitted_at, trend: makeTrend(90, 2, 2) },
      waitlist: { total: SUBSCRIBERS.length, recent: SUBSCRIBERS[SUBSCRIBERS.length - 1].signed_up_at, trend: makeTrend(90, 1, 1) },
      media: { total: MEDIA_ITEMS.length, recent: MEDIA_ITEMS[MEDIA_ITEMS.length - 1].uploaded_at },
      system: { uptime: 864000, memory: { heapUsed: 78643200 }, node_version: 'v20.11.0' },
    },
  })],

  // Submissions (contacts)
  [/\/admin\/submissions\/todos-summary$/, () => ({ data: { total: 3, overdue: 1, upcoming: 2 } })],
  [/\/admin\/submissions\/todo-contact-ids$/, () => ({ data: [1, 4] })],
  [/\/admin\/submissions\/activity$/, () => ({ data: [] })],
  [/\/admin\/submissions\/status-history$/, () => ({ data: {} })],
  [/\/admin\/submissions\/bulk-delete$/, () => ({ success: true })],
  [/\/admin\/submissions\/\d+\/notes$/, () => ({ data: [] })],
  [/\/admin\/submissions\/\d+\/status$/, () => ({ success: true })],
  [/\/admin\/submissions\/\d+\/follow-up$/, () => ({ success: true })],
  [/\/admin\/submissions\/\d+\/send-email$/, () => ({ success: true })],
  [/\/admin\/submissions\/\d+/, () => ({ data: CONTACTS[0] })],
  [/\/admin\/submissions$/, (_url, params) => {
    const limit = parseInt(params?.limit || '20');
    const offset = parseInt(params?.offset || '0');
    return {
      data: CONTACTS.slice(offset, offset + limit),
      pagination: { total: CONTACTS.length, limit, offset },
    };
  }],

  // Media
  [/\/media\/portfolio$/, (_url, params) => {
    const limit = parseInt(params?.limit || '20');
    const offset = parseInt(params?.offset || '0');
    return {
      data: MEDIA_ITEMS.slice(offset, offset + limit),
      pagination: { total: MEDIA_ITEMS.length, limit, offset },
    };
  }],
  [/\/admin\/media\/upload$/, () => ({ data: MEDIA_ITEMS[0] })],
  [/\/admin\/media\/bulk-download$/, () => new Blob(['demo'], { type: 'application/zip' })],
  [/\/admin\/media\/\d+/, () => ({ data: MEDIA_ITEMS[0] })],

  // Waitlist (subscribers)
  [/\/admin\/waitlist\/tags$/, () => ({ data: ['early-access', 'beta', 'newsletter', 'updates'] })],
  [/\/admin\/waitlist\/export$/, () => new Blob(['email,name\n'], { type: 'text/csv' })],
  [/\/admin\/waitlist\/count-by-target$/, () => ({ data: { count: SUBSCRIBERS.length } })],
  [/\/admin\/waitlist\/preview-recipients$/, () => ({ data: SUBSCRIBERS.slice(0, 5) })],
  [/\/admin\/waitlist\/bulk-delete$/, () => ({ success: true })],
  [/\/admin\/waitlist\/\d+$/, () => ({ success: true })],
  [/\/admin\/waitlist$/, (_url, params) => {
    const limit = parseInt(params?.limit || '20');
    const offset = parseInt(params?.offset || '0');
    return {
      data: SUBSCRIBERS.slice(offset, offset + limit),
      pagination: { total: SUBSCRIBERS.length, limit, offset },
    };
  }],

  // Invoices
  [/\/admin\/invoices-next-number$/, () => ({ data: { invoice_number: 'INV-2026-005' } })],
  [/\/admin\/invoices\/\d+$/, (url) => {
    const id = parseInt(url.match(/\/(\d+)$/)?.[1] || '1');
    return { data: INVOICES.find(i => i.id === id) || INVOICES[0] };
  }],
  [/\/admin\/invoices$/, (_url, params) => {
    const limit = parseInt(params?.limit || '20');
    const offset = parseInt(params?.offset || '0');
    const status = params?.status;
    const filtered = status ? INVOICES.filter(i => i.status === status) : INVOICES;
    return {
      data: filtered.slice(offset, offset + limit),
      pagination: { total: filtered.length, limit, offset },
    };
  }],

  // Campaigns
  [/\/admin\/campaigns\/\d+\/send$/, () => ({ success: true })],
  [/\/admin\/campaigns\/\d+$/, (url) => {
    const id = parseInt(url.match(/\/(\d+)$/)?.[1] || '1');
    return { data: CAMPAIGNS.find(c => c.id === id) || CAMPAIGNS[0] };
  }],
  [/\/admin\/campaigns$/, (_url, params) => {
    const limit = parseInt(params?.limit || '20');
    const offset = parseInt(params?.offset || '0');
    return {
      data: CAMPAIGNS.slice(offset, offset + limit),
      pagination: { total: CAMPAIGNS.length, limit, offset },
    };
  }],

  // Settings
  [/\/admin\/settings\/menu$/, () => ({ data: {} })],
  [/\/admin\/settings$/, () => ({
    data: {
      email_enabled: true,
      maintenance_mode: false,
      maintenance_message: '',
      display_timezone: 'America/New_York',
      default_dashboard_days: 30,
      show_ip_addresses: false,
      truncate_emails: false,
    },
  })],

  // Credentials
  [/\/admin\/credentials\/verify-key$/, () => ({ valid: true })],
  [/\/admin\/credentials$/, () => ({
    data: {
      email: { active_provider: 'resend', from_address: 'hello@anima.dev', display_name: 'Anima Digital', notification_address: 'admin@anima.dev' },
      storage: {},
    },
  })],

  // Logs
  [/\/admin\/logs$/, (_url, params) => {
    const limit = parseInt(params?.limit || '20');
    const offset = parseInt(params?.offset || '0');
    return {
      data: LOGS.slice(offset, offset + limit),
      pagination: { total: LOGS.length, limit, offset },
    };
  }],

  // Sites
  [/\/admin\/sites\/\d+\/regenerate$/, () => ({ data: { api_key: 'demo_key_' + Math.random().toString(36).slice(2, 10) } })],
  [/\/admin\/sites$/, () => ({
    data: [
      { id: 1, name: 'Portfolio Site', domain: 'anima.dev', api_key: 'sk_live_demo1234567890', is_active: true, created_at: daysAgo(60) },
      { id: 2, name: 'Staging', domain: 'staging.anima.dev', api_key: 'sk_test_demo0987654321', is_active: true, created_at: daysAgo(45) },
    ],
  })],

  // Email templates
  [/\/admin\/email-templates\/\w+$/, () => ({ success: true })],
  [/\/admin\/email-templates$/, () => ({
    data: {
      'contact-confirmation': { name: 'Contact Confirmation', default_html: '<h1>Thanks for reaching out!</h1>', custom_html: null, variables: ['name', 'company'] },
      'waitlist-welcome': { name: 'Waitlist Welcome', default_html: '<h1>Welcome to the waitlist!</h1>', custom_html: null, variables: ['name', 'email'] },
    },
  })],

  // Email test
  [/\/admin\/test-email\//, () => ({ success: true })],

  // Email compose
  [/\/admin\/email\/compose$/, () => ({ success: true })],
];

export function matchDemoRoute(url: string, params?: Record<string, string>): unknown | null {
  // Strip baseURL prefix if present
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '');
  for (const [pattern, handler] of demoRoutes) {
    if (pattern.test(path)) {
      return handler(path, params);
    }
  }
  return null;
}
