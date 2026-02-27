#!/usr/bin/env node

import { program } from 'commander';
import { createInterface } from 'readline';
import axios from 'axios';
import Table from 'cli-table3';
import chalk from 'chalk';
import config from '../src/config/index.js';

const API_URL = process.env.API_URL || `http://localhost:${config.port}/api`;
const API_KEY = process.env.ADMIN_API_KEY || config.adminApiKey;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'X-API-Key': API_KEY,
  },
});

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function showStats() {
  try {
    const response = await api.get('/admin/stats');
    const stats = response.data.data;
    
    console.log(chalk.cyan('\n📊 System Statistics\n'));
    
    const table = new Table({
      head: ['Metric', 'Value'],
      colWidths: [30, 40],
    });
    
    table.push(
      ['Total Contacts', stats.contacts.total],
      ['Last Contact', stats.contacts.recent || 'Never'],
      ['Total Waitlist', stats.waitlist.total],
      ['Last Waitlist Signup', stats.waitlist.recent || 'Never'],
      ['Total Media Files', stats.media.total],
      ['Last Upload', stats.media.recent || 'Never'],
      ['System Uptime', `${Math.floor(stats.system.uptime / 3600)} hours`],
      ['Memory Usage', `${Math.round(stats.system.memory.rss / 1024 / 1024)} MB`],
    );
    
    console.log(table.toString());
  } catch (error) {
    console.error(chalk.red('Error fetching stats:'), error.message);
  }
}

async function listContacts() {
  try {
    const response = await api.get('/admin/submissions');
    const contacts = response.data.data;
    
    if (contacts.length === 0) {
      console.log(chalk.yellow('\nNo contact submissions found.'));
      return;
    }
    
    console.log(chalk.cyan(`\n📧 Contact Submissions (${contacts.length} total)\n`));
    
    const table = new Table({
      head: ['ID', 'Name', 'Email', 'Company', 'Date'],
      colWidths: [10, 20, 30, 20, 25],
    });
    
    contacts.slice(0, 10).forEach(contact => {
      table.push([
        contact.id,
        contact.name,
        contact.email,
        contact.company || '-',
        new Date(contact.submitted_at).toLocaleDateString(),
      ]);
    });
    
    console.log(table.toString());
    
    if (contacts.length > 10) {
      console.log(chalk.gray(`\n... and ${contacts.length - 10} more`));
    }
  } catch (error) {
    console.error(chalk.red('Error fetching contacts:'), error.message);
  }
}

async function viewContact() {
  const id = await prompt('Enter contact ID: ');
  
  try {
    const response = await api.get(`/admin/submissions`);
    const contact = response.data.data.find(c => c.id === parseInt(id));
    
    if (!contact) {
      console.log(chalk.red('\nContact not found.'));
      return;
    }
    
    console.log(chalk.cyan(`\n📧 Contact Details\n`));
    console.log(chalk.bold('ID:'), contact.id);
    console.log(chalk.bold('Name:'), contact.name);
    console.log(chalk.bold('Email:'), contact.email);
    console.log(chalk.bold('Company:'), contact.company || '-');
    console.log(chalk.bold('Project Type:'), contact.project_type || '-');
    console.log(chalk.bold('Message:'));
    console.log(chalk.gray(contact.message));
    console.log(chalk.bold('Submitted:'), new Date(contact.submitted_at).toLocaleString());
    console.log(chalk.bold('IP:'), contact.ip_address || '-');
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  }
}

async function deleteContact() {
  const id = await prompt('Enter contact ID to delete: ');
  const confirm = await prompt(`Are you sure you want to delete contact ${id}? (yes/no): `);
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('Cancelled.');
    return;
  }
  
  try {
    await api.delete(`/admin/submission/${id}`);
    console.log(chalk.green(`\n✅ Contact ${id} deleted successfully.`));
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  }
}

async function listWaitlist() {
  try {
    const response = await api.get('/admin/waitlist');
    const entries = response.data.data;
    
    if (entries.length === 0) {
      console.log(chalk.yellow('\nNo waitlist entries found.'));
      return;
    }
    
    console.log(chalk.cyan(`\n📝 Waitlist Entries (${entries.length} total)\n`));
    
    const table = new Table({
      head: ['ID', 'Email', 'Name', 'Date'],
      colWidths: [10, 35, 25, 25],
    });
    
    entries.slice(0, 10).forEach(entry => {
      table.push([
        entry.id,
        entry.email,
        entry.name || '-',
        new Date(entry.signed_up_at).toLocaleDateString(),
      ]);
    });
    
    console.log(table.toString());
    
    if (entries.length > 10) {
      console.log(chalk.gray(`\n... and ${entries.length - 10} more`));
    }
  } catch (error) {
    console.error(chalk.red('Error fetching waitlist:'), error.message);
  }
}

async function exportWaitlist() {
  try {
    console.log(chalk.cyan('\n📥 Exporting waitlist...'));
    const response = await api.get('/admin/waitlist/export');
    
    const filename = `waitlist-${new Date().toISOString().split('T')[0]}.csv`;
    await require('fs').promises.writeFile(filename, response.data);
    
    console.log(chalk.green(`\n✅ Waitlist exported to ${filename}`));
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  }
}

async function runMigrations() {
  const confirm = await prompt('Are you sure you want to run migrations? (yes/no): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('Cancelled.');
    return;
  }
  
  try {
    await api.post('/admin/migrate');
    console.log(chalk.green('\n✅ Migrations completed successfully.'));
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  }
}

async function showMenu() {
  console.log(chalk.cyan('\n🛠️  Lite Backend Admin CLI\n'));
  console.log('1. Show statistics');
  console.log('2. List contact submissions');
  console.log('3. View contact details');
  console.log('4. Delete contact');
  console.log('5. List waitlist entries');
  console.log('6. Export waitlist');
  console.log('7. Run migrations');
  console.log('0. Exit');
  
  const choice = await prompt('\nSelect an option: ');
  
  switch (choice) {
    case '1':
      await showStats();
      break;
    case '2':
      await listContacts();
      break;
    case '3':
      await viewContact();
      break;
    case '4':
      await deleteContact();
      break;
    case '5':
      await listWaitlist();
      break;
    case '6':
      await exportWaitlist();
      break;
    case '7':
      await runMigrations();
      break;
    case '0':
      console.log(chalk.yellow('\nGoodbye! 👋'));
      rl.close();
      process.exit(0);
    default:
      console.log(chalk.red('\nInvalid option.'));
  }
  
  await showMenu();
}

// Command line arguments
program
  .name('admin-cli')
  .description('Lite Backend Admin CLI')
  .option('--api-url <url>', 'API URL', API_URL)
  .option('--api-key <key>', 'Admin API key', API_KEY)
  .command('stats', 'Show system statistics')
  .command('export-contacts', 'Export contacts to CSV')
  .command('clean-old-submissions', 'Clean old submissions')
  .parse(process.argv);

// Handle direct commands
if (process.argv.length > 2) {
  const command = process.argv[2];
  
  switch (command) {
    case 'stats':
      showStats().then(() => process.exit(0));
      break;
    case 'export-contacts':
      console.log('Use the export-submissions.js script for this.');
      process.exit(0);
      break;
    case 'clean-old-submissions':
      console.log('Use the clean-database.js script for this.');
      process.exit(0);
      break;
    default:
      showMenu();
  }
} else {
  // Interactive mode
  showMenu();
}