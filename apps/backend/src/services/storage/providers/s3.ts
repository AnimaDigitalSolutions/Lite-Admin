import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { nanoid } from 'nanoid';
import path from 'path';
import type { Express } from 'express';
import logger from '../../../utils/logger.js';
import ImageOptimizer from '../utils/optimizer.js';

interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

interface ImageMetadata {
  originalWidth?: number;
  originalHeight?: number;
  format?: string;
  quality?: number;
}

interface UploadResult {
  provider: string;
  path: string;
  url: string;
  size: number;
  mimetype: string;
  metadata: ImageMetadata | null;
}

interface S3FileItem {
  key: string;
  size: number;
  lastModified: Date;
  url: string;
}

class S3StorageProvider {
  private bucket: string;
  private region: string;
  private client: S3Client;
  private optimizer: ImageOptimizer;

  constructor(config: S3Config) {
    this.bucket = config.bucket;
    this.region = config.region;
    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.optimizer = new ImageOptimizer();
  }

  async initialize(): Promise<void> {
    logger.info('S3 storage provider initialized');
  }

  async upload(file: Express.Multer.File, destinationPath?: string): Promise<UploadResult> {
    try {
      const fileId = nanoid();
      const fileExt = path.extname(file.originalname);
      const fileName = `${fileId}${fileExt}`;
      const key = destinationPath ? `${destinationPath}/${fileName}` : fileName;
      
      // Upload original file
      const uploadParams = {
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      };
      
      await this.client.send(new PutObjectCommand(uploadParams));
      
      // Handle image optimization
      let metadata = null;
      if (this.isImage(file.mimetype)) {
        // Optimize and upload WebP version
        const optimizedData = await this.optimizer.optimize(file.buffer, {
          format: 'webp',
          quality: 85,
        });
        
        const optimizedKey = key.replace(fileExt, '.webp');
        await this.client.send(new PutObjectCommand({
          Bucket: this.bucket,
          Key: optimizedKey,
          Body: optimizedData.buffer,
          ContentType: 'image/webp',
        }));
        
        // Create and upload thumbnail
        const thumbnailData = await this.optimizer.createThumbnail(file.buffer, {
          width: 300,
          height: 300,
        });
        
        const thumbnailKey = `thumbnails/${fileId}_thumb.webp`;
        await this.client.send(new PutObjectCommand({
          Bucket: this.bucket,
          Key: thumbnailKey,
          Body: thumbnailData.buffer,
          ContentType: 'image/webp',
        }));
        
        metadata = optimizedData.metadata;
      }
      
      logger.info(`File uploaded to S3: ${key}`);
      
      return {
        provider: 's3',
        path: key,
        url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`,
        size: file.size,
        mimetype: file.mimetype,
        metadata: metadata,
      };
    } catch (error) {
      logger.error({
        message: 'Failed to upload file to S3',
        error: error
      });
      throw error;
    }
  }

  async download(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      
      const response = await this.client.send(command);
      const chunks: Uint8Array[] = [];
      
      if (response.Body) {
        const stream = response.Body as AsyncIterable<Uint8Array>;
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
      }
      
      return Buffer.concat(chunks);
    } catch (error) {
      logger.error({
        message: 'Failed to download file from S3',
        error: error
      });
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      // Delete main file
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      
      // Try to delete associated files
      const fileId = path.basename(key, path.extname(key));
      const associatedKeys = [
        key.replace(path.extname(key), '.webp'),
        `thumbnails/${fileId}_thumb.webp`,
      ];
      
      for (const associatedKey of associatedKeys) {
        try {
          await this.client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: associatedKey,
          }));
        } catch {
          // Ignore errors for associated files
        }
      }
      
      logger.info(`File deleted from S3: ${key}`);
      return true;
    } catch (error) {
      logger.error({
        message: 'Failed to delete file from S3',
        error: error
      });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      
      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string, _expiresIn: number = 3600): Promise<string> {
    try {
      // For simplicity, return direct URL - in production you'd use presigned URLs
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    } catch (error) {
      logger.error({
        message: 'Failed to generate signed URL',
        error: error
      });
      throw error;
    }
  }

  async listFiles(prefix: string = ''): Promise<S3FileItem[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: 1000,
      });
      
      const response = await this.client.send(command);
      
      return (response.Contents || []).map(item => ({
        key: item.Key!,
        size: item.Size!,
        lastModified: item.LastModified!,
        url: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${item.Key}`,
      }));
    } catch (error) {
      logger.error({
        message: 'Failed to list S3 files',
        error: error
      });
      throw error;
    }
  }

  isImage(mimetype: string): boolean {
    return Boolean(mimetype && mimetype.startsWith('image/'));
  }

  get provider(): string {
    return 's3';
  }

  getThumbnailUrl(originalUrl: string): string {
    const key = originalUrl.split('.com/')[1];
    const fileId = path.basename(key, path.extname(key));
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/thumbnails/${fileId}_thumb.webp`;
  }
}

export default S3StorageProvider;