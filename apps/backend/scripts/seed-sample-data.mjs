#!/usr/bin/env node

/**
 * Seed script to populate the database with sample data for demo purposes
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedSampleData() {
  console.log('🌱 Seeding sample data...');

  try {
    // Dynamic import for ES modules
    const { default: DatabaseService } = await import('../src/services/database.service.js');
    
    // Initialize database
    await DatabaseService.initialize();
    const db = await DatabaseService.getInstance();
    
    console.log('📊 Connected to database');

    // Sample contacts data
    const contacts = [
      {
        name: 'Sarah Johnson',
        email: 'sarah@techstartup.com',
        company: 'TechStartup Inc.',
        project_type: 'Web Application',
        message: 'Hi! We need a modern web application for our fintech startup. Looking for a team that can handle both frontend and backend development. Our timeline is 3-4 months.',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        submitted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
      },
      {
        name: 'Michael Chen',
        email: 'michael@designstudio.com',
        company: 'Creative Design Studio',
        project_type: 'E-commerce',
        message: 'Looking to revamp our e-commerce platform. We need someone who understands UX/UI design and can implement a seamless shopping experience. Budget is $50k-75k.',
        ip_address: '10.0.0.25',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        submitted_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
      },
      {
        name: 'Emma Rodriguez',
        email: 'emma@nonprofit.org',
        company: 'Community Nonprofit',
        project_type: 'Website Redesign',
        message: 'Our nonprofit needs a website redesign to better showcase our mission and make donations easier. We\'re working with a limited budget but are passionate about our cause.',
        ip_address: '172.16.0.50',
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        submitted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day ago
      },
      {
        name: 'David Kim',
        email: 'david@healthtech.io',
        company: 'HealthTech Solutions',
        project_type: 'Mobile App',
        message: 'We need a mobile app for patient management. HIPAA compliance is crucial. The app should work on both iOS and Android. Timeline is 6 months.',
        ip_address: '203.0.113.42',
        user_agent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
        submitted_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
      },
      {
        name: 'Lisa Wang',
        email: 'lisa@retailchain.com',
        company: 'Retail Chain Co.',
        project_type: 'API Development',
        message: 'We need to develop APIs to integrate our inventory management system with multiple third-party platforms. Experience with REST APIs and webhooks required.',
        ip_address: '198.51.100.15',
        user_agent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        submitted_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 1 week ago
      }
    ];

    // Sample waitlist entries
    const waitlistEntries = [
      {
        email: 'alex@entrepreneur.com',
        name: 'Alex Thompson',
        ip_address: '192.168.1.105',
        signed_up_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() // 4 days ago
      },
      {
        email: 'priya@startup.io',
        name: 'Priya Patel',
        ip_address: '10.0.0.30',
        signed_up_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() // 6 days ago
      },
      {
        email: 'carlos@agency.com',
        name: 'Carlos Mendez',
        ip_address: '172.16.0.75',
        signed_up_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
      },
      {
        email: 'jennifer@consultant.biz',
        name: 'Jennifer White',
        ip_address: '203.0.113.88',
        signed_up_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() // 8 days ago
      },
      {
        email: 'ryan@techblog.net',
        name: 'Ryan Foster',
        ip_address: '198.51.100.99',
        signed_up_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day ago
      },
      {
        email: 'maria@digitalmarketing.pro',
        name: 'Maria Gonzalez',
        ip_address: '192.0.2.150',
        signed_up_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() // 12 hours ago
      }
    ];

    // Insert contacts
    console.log('📮 Inserting sample contacts...');
    for (const contact of contacts) {
      try {
        const result = await db.contacts.create(contact);
        console.log(`   ✓ Added contact: ${contact.name} (${contact.email})`);
      } catch (error) {
        console.log(`   ✗ Failed to add contact ${contact.name}: ${error.message}`);
      }
    }

    // Insert waitlist entries
    console.log('📋 Inserting sample waitlist entries...');
    for (const entry of waitlistEntries) {
      try {
        const result = await db.waitlist.create(entry);
        console.log(`   ✓ Added waitlist entry: ${entry.name || entry.email} (${entry.email})`);
      } catch (error) {
        console.log(`   ✗ Failed to add waitlist entry ${entry.email}: ${error.message}`);
      }
    }

    console.log('🎉 Sample data seeding completed!');
    console.log('\n📊 Summary:');
    console.log(`   • ${contacts.length} contact submissions added`);
    console.log(`   • ${waitlistEntries.length} waitlist entries added`);
    console.log('\nYou can now view the sample data in the admin dashboard! 🚀');

  } catch (error) {
    console.error('❌ Error seeding sample data:', error);
    process.exit(1);
  } finally {
    // Clean up database connection
    try {
      const { default: DatabaseService } = await import('../src/services/database.service.js');
      await DatabaseService.close();
      console.log('🔌 Database connection closed');
    } catch (error) {
      console.error('Error closing database:', error);
    }
  }
}

// Run the seeding script
seedSampleData().catch(console.error);