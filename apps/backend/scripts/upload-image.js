#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { basename, extname } from 'path';
import { program } from 'commander';
import axios from 'axios';
import FormData from 'form-data';
import config from '../src/config/index.js';

program
  .name('upload-image')
  .description('Upload portfolio image to the backend')
  .requiredOption('-f, --file <path>', 'Path to image file')
  .option('-p, --project <name>', 'Project name', '')
  .option('-d, --description <text>', 'Image description', '')
  .option('--api-key <key>', 'Admin API key (or set ADMIN_API_KEY env)', process.env.ADMIN_API_KEY)
  .option('--api-url <url>', 'API base URL', `http://localhost:${config.port}/api`)
  .option('--folder <path>', 'Upload all images from folder')
  .parse();

const options = program.opts();

async function uploadImage(filePath, projectName = '', description = '') {
  try {
    console.log(`📸 Uploading ${basename(filePath)}...`);
    
    const form = new FormData();
    form.append('image', createReadStream(filePath));
    form.append('project_name', projectName);
    form.append('description', description);
    
    const response = await axios.post(
      `${options.apiUrl}/admin/media/upload`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'X-API-Key': options.apiKey,
        },
      }
    );
    
    console.log(`✅ Uploaded successfully!`);
    console.log(`   ID: ${response.data.data.id}`);
    console.log(`   URL: ${response.data.data.url}`);
    
    return response.data;
  } catch (error) {
    console.error(`❌ Upload failed for ${filePath}:`);
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function uploadFolder(folderPath) {
  const { readdir } = await import('fs/promises');
  const files = await readdir(folderPath);
  
  const imageFiles = files.filter(file => {
    const ext = extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
  });
  
  console.log(`📁 Found ${imageFiles.length} images in ${folderPath}`);
  
  const results = [];
  for (const file of imageFiles) {
    try {
      const result = await uploadImage(
        `${folderPath}/${file}`,
        options.project || basename(file, extname(file)),
        options.description
      );
      results.push({ file, success: true, result });
    } catch (error) {
      results.push({ file, success: false, error: error.message });
    }
  }
  
  // Summary
  console.log('\n📊 Upload Summary:');
  console.log(`   Total: ${results.length}`);
  console.log(`   Success: ${results.filter(r => r.success).length}`);
  console.log(`   Failed: ${results.filter(r => !r.success).length}`);
  
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log('\n❌ Failed uploads:');
    failed.forEach(f => console.log(`   - ${f.file}: ${f.error}`));
  }
}

async function main() {
  try {
    if (!options.apiKey) {
      console.error('❌ API key required. Set ADMIN_API_KEY env or use --api-key');
      process.exit(1);
    }
    
    if (options.folder) {
      await uploadFolder(options.folder);
    } else if (options.file) {
      await uploadImage(options.file, options.project, options.description);
    } else {
      console.error('❌ Either --file or --folder is required');
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();