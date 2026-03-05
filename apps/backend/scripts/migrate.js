#!/usr/bin/env node

import { program } from 'commander';
import DatabaseFactory from '../src/database/index.js';
import config from '../src/config/index.js';

program
  .name('migrate')
  .description('Run database migrations')
  .option('-t, --type <type>', 'Database type (sqlite, postgres, mysql)', config.database.type)
  .option('--reset', 'Drop all tables before migrating (DANGEROUS)')
  .parse();

const options = program.opts();

async function runMigrations(db, reset = false) {
  console.log(`🔄 Running migrations for ${options.type}...`);
  
  if (reset) {
    console.log('⚠️  RESETTING DATABASE - All data will be lost!');
    console.log('   Press Ctrl+C within 5 seconds to cancel...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Drop all tables
    const tables = ['contacts', 'waitlist', 'portfolio_media', 'admin_logs'];
    for (const table of tables) {
      try {
        await db.run(`DROP TABLE IF EXISTS ${table}`);
        console.log(`   Dropped table: ${table}`);
      } catch (error) {
        console.log(`   Could not drop table ${table}: ${error.message}`);
      }
    }
  }
  
  // Run migrations
  await db.migrate();
  
  console.log('✅ Migrations completed successfully');
}

async function main() {
  let db;
  
  try {
    // Override config with command line option
    const dbConfig = {
      ...config.database,
      type: options.type,
    };
    
    console.log(`🗄️  Connecting to ${options.type} database...`);
    db = await DatabaseFactory.create(options.type);
    
    // For new databases, we need to connect first
    if (options.type === 'sqlite') {
      await db.connect();
    } else {
      await db.initialize();
    }
    
    await runMigrations(db, options.reset);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (db) {
      await db.close();
    }
  }
}

main();