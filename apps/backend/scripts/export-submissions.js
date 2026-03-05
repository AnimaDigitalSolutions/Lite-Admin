#!/usr/bin/env node

import { writeFile } from 'fs/promises';
import { program } from 'commander';
import axios from 'axios';
import config from '../src/config/index.js';

program
  .name('export-submissions')
  .description('Export form submissions to CSV')
  .option('--api-key <key>', 'Admin API key (or set ADMIN_API_KEY env)', process.env.ADMIN_API_KEY)
  .option('--api-url <url>', 'API base URL', `http://localhost:${config.port}/api`)
  .option('-t, --type <type>', 'Export type: contacts or waitlist', 'contacts')
  .option('-o, --output <file>', 'Output filename', null)
  .option('-f, --format <format>', 'Output format: csv or json', 'csv')
  .parse();

const options = program.opts();

async function fetchData(endpoint) {
  try {
    const response = await axios.get(
      `${options.apiUrl}/admin/${endpoint}`,
      {
        headers: {
          'X-API-Key': options.apiKey,
        },
        params: {
          limit: 10000, // Get all records
          offset: 0,
        },
      }
    );
    
    return response.data.data;
  } catch (error) {
    console.error(`❌ Failed to fetch data:`);
    console.error(error.response?.data || error.message);
    throw error;
  }
}

function formatContactsCSV(contacts) {
  const headers = [
    'ID',
    'Name',
    'Email',
    'Company',
    'Project Type',
    'Message',
    'Submitted At',
    'IP Address',
  ];
  
  const rows = contacts.map(contact => [
    contact.id,
    contact.name,
    contact.email,
    contact.company || '',
    contact.project_type || '',
    `"${contact.message.replace(/"/g, '""')}"`, // Escape quotes in message
    contact.submitted_at,
    contact.ip_address || '',
  ]);
  
  return [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
}

function formatWaitlistCSV(entries) {
  const headers = [
    'ID',
    'Email',
    'Name',
    'Signed Up At',
    'IP Address',
  ];
  
  const rows = entries.map(entry => [
    entry.id,
    entry.email,
    entry.name || '',
    entry.signed_up_at,
    entry.ip_address || '',
  ]);
  
  return [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
}

async function main() {
  try {
    if (!options.apiKey) {
      console.error('❌ API key required. Set ADMIN_API_KEY env or use --api-key');
      process.exit(1);
    }
    
    console.log(`📊 Exporting ${options.type}...`);
    
    let data;
    let csvContent;
    let defaultFilename;
    
    if (options.type === 'contacts') {
      data = await fetchData('submissions');
      csvContent = formatContactsCSV(data);
      defaultFilename = `contacts-${new Date().toISOString().split('T')[0]}.${options.format}`;
    } else if (options.type === 'waitlist') {
      data = await fetchData('waitlist');
      csvContent = formatWaitlistCSV(data);
      defaultFilename = `waitlist-${new Date().toISOString().split('T')[0]}.${options.format}`;
    } else {
      console.error('❌ Invalid type. Use "contacts" or "waitlist"');
      process.exit(1);
    }
    
    const outputFile = options.output || defaultFilename;
    
    if (options.format === 'json') {
      await writeFile(outputFile, JSON.stringify(data, null, 2));
    } else {
      await writeFile(outputFile, csvContent);
    }
    
    console.log(`✅ Exported ${data.length} records to ${outputFile}`);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();