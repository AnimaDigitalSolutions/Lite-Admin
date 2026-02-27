#!/usr/bin/env node

import { program } from 'commander';
import DatabaseFactory from '../src/database/index.js';
import config from '../src/config/index.js';

program
  .name('clean-database')
  .description('Clean old data from database')
  .option('-d, --days <days>', 'Delete data older than X days', '90')
  .option('-t, --type <type>', 'Data type to clean: all, contacts, logs', 'all')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .parse();

const options = program.opts();

async function cleanOldData(db, days, dryRun) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
  
  console.log(`🧹 Cleaning data older than ${cutoffDate.toISOString()}`);
  
  const results = {
    contacts: 0,
    logs: 0,
  };
  
  // Clean old contact submissions
  if (options.type === 'all' || options.type === 'contacts') {
    const oldContacts = await db.all(
      `SELECT id FROM contacts WHERE submitted_at < ?`,
      [cutoffDate.toISOString()]
    );
    
    results.contacts = oldContacts.length;
    
    if (!dryRun && oldContacts.length > 0) {
      await db.run(
        `DELETE FROM contacts WHERE submitted_at < ?`,
        [cutoffDate.toISOString()]
      );
    }
  }
  
  // Clean old admin logs
  if (options.type === 'all' || options.type === 'logs') {
    const oldLogs = await db.all(
      `SELECT id FROM admin_logs WHERE created_at < ?`,
      [cutoffDate.toISOString()]
    );
    
    results.logs = oldLogs.length;
    
    if (!dryRun && oldLogs.length > 0) {
      await db.run(
        `DELETE FROM admin_logs WHERE created_at < ?`,
        [cutoffDate.toISOString()]
      );
    }
  }
  
  return results;
}

async function main() {
  let db;
  
  try {
    console.log('🗄️  Connecting to database...');
    db = await DatabaseFactory.create(config.database.type);
    await db.initialize();
    
    const results = await cleanOldData(db, options.days, options.dryRun);
    
    console.log('\n📊 Cleanup Summary:');
    console.log(`   Contact submissions: ${results.contacts} records`);
    console.log(`   Admin logs: ${results.logs} records`);
    
    if (options.dryRun) {
      console.log('\n⚠️  DRY RUN - No data was actually deleted');
    } else {
      console.log('\n✅ Cleanup completed successfully');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

main();