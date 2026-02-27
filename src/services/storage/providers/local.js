import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import logger from '../../../utils/logger.js';
import ImageOptimizer from '../utils/optimizer.js';

class LocalStorageProvider {
  constructor(config) {
    this.uploadDir = config.uploadDir;
    this.optimizer = new ImageOptimizer();
  }

  async initialize() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'portfolio'), { recursive: true });
      await fs.mkdir(path.join(this.uploadDir, 'thumbnails'), { recursive: true });
      logger.info('Local storage initialized');
    } catch (error) {
      logger.error('Failed to initialize local storage:', error);
      throw error;
    }
  }

  async upload(file, destinationPath) {
    try {
      const fileId = nanoid();
      const fileExt = path.extname(file.originalname);
      const fileName = `${fileId}${fileExt}`;
      const fullPath = path.join(this.uploadDir, destinationPath || '', fileName);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      
      // Save original file
      await fs.writeFile(fullPath, file.buffer);
      
      // Generate optimized versions for images
      let optimizedData = null;
      if (this.isImage(file.mimetype)) {
        optimizedData = await this.optimizer.optimize(file.buffer, {
          format: 'webp',
          quality: 85,
        });
        
        // Save optimized version
        const optimizedPath = fullPath.replace(fileExt, '.webp');
        await fs.writeFile(optimizedPath, optimizedData.buffer);
        
        // Generate thumbnail
        const thumbnailData = await this.optimizer.createThumbnail(file.buffer, {
          width: 300,
          height: 300,
        });
        
        const thumbnailPath = path.join(
          this.uploadDir,
          'thumbnails',
          `${fileId}_thumb.webp`
        );
        await fs.writeFile(thumbnailPath, thumbnailData.buffer);
      }
      
      logger.info(`File uploaded to local storage: ${fullPath}`);
      
      return {
        provider: 'local',
        path: fullPath,
        url: `/uploads/${destinationPath || ''}${fileName}`,
        size: file.size,
        mimetype: file.mimetype,
        metadata: optimizedData?.metadata || null,
      };
    } catch (error) {
      logger.error('Failed to upload file to local storage:', error);
      throw error;
    }
  }

  async download(filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      return buffer;
    } catch (error) {
      logger.error('Failed to download file from local storage:', error);
      throw error;
    }
  }

  async delete(filePath) {
    try {
      await fs.unlink(filePath);
      
      // Try to delete associated files (thumbnail, optimized versions)
      const dir = path.dirname(filePath);
      const basename = path.basename(filePath, path.extname(filePath));
      
      const associatedFiles = [
        path.join(dir, `${basename}.webp`),
        path.join(this.uploadDir, 'thumbnails', `${basename}_thumb.webp`),
      ];
      
      for (const file of associatedFiles) {
        try {
          await fs.unlink(file);
        } catch (err) {
          // Ignore errors for associated files
        }
      }
      
      logger.info(`File deleted from local storage: ${filePath}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete file from local storage:', error);
      throw error;
    }
  }

  async exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
      };
    } catch (error) {
      logger.error('Failed to get file metadata:', error);
      throw error;
    }
  }

  async listFiles(directory = '') {
    try {
      const fullPath = path.join(this.uploadDir, directory);
      const files = await fs.readdir(fullPath, { withFileTypes: true });
      
      return files
        .filter(dirent => dirent.isFile())
        .map(dirent => ({
          name: dirent.name,
          path: path.join(fullPath, dirent.name),
          url: `/uploads/${directory}${directory ? '/' : ''}${dirent.name}`,
        }));
    } catch (error) {
      logger.error('Failed to list files:', error);
      throw error;
    }
  }

  isImage(mimetype) {
    return mimetype && mimetype.startsWith('image/');
  }

  getThumbnailUrl(originalUrl) {
    const fileId = path.basename(originalUrl, path.extname(originalUrl));
    return `/uploads/thumbnails/${fileId}_thumb.webp`;
  }
}

export default LocalStorageProvider;