import sharp from 'sharp';
import config from '../../../config/index.js';
import logger from '../../../utils/logger.js';

interface OptimizeOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: string;
}

interface OptimizeResult {
  buffer: Buffer;
  metadata: {
    originalWidth?: number;
    originalHeight?: number;
    format: string;
    size: number;
  };
}

interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
}

interface ThumbnailResult {
  buffer: Buffer;
  width: number;
  height: number;
}

interface ImageMetadata {
  width?: number;
  height?: number;
  format?: string;
  size: number;
  hasAlpha?: boolean;
  orientation?: number;
}

class ImageOptimizer {
  private defaultQuality: number;
  private thumbnailSize: { width: number; height: number };

  constructor() {
    this.defaultQuality = config.image.quality;
    this.thumbnailSize = config.image.thumbnail;
  }

  async optimize(buffer: Buffer, options: OptimizeOptions = {}): Promise<OptimizeResult> {
    try {
      const {
        width = null,
        height = null,
        quality = this.defaultQuality,
        format = 'webp',
      } = options;

      let pipeline = sharp(buffer);
      
      // Get metadata first
      const metadata = await pipeline.metadata();
      
      // Resize if dimensions provided
      if (width || height) {
        pipeline = pipeline.resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
      
      // Convert format and optimize
      switch (format) {
        case 'webp':
          pipeline = pipeline.webp({ quality });
          break;
        case 'jpeg':
        case 'jpg':
          pipeline = pipeline.jpeg({ quality, progressive: true });
          break;
        case 'png':
          pipeline = pipeline.png({ quality, compressionLevel: 9 });
          break;
        default:
          pipeline = pipeline.webp({ quality });
      }
      
      const optimizedBuffer = await pipeline.toBuffer();
      
      logger.info(`Image optimized: ${metadata.width}x${metadata.height} -> ${format}`);
      
      return {
        buffer: optimizedBuffer,
        metadata: {
          originalWidth: metadata.width,
          originalHeight: metadata.height,
          format: format,
          size: optimizedBuffer.length,
        },
      };
    } catch (error) {
      logger.error({
        message: 'Failed to optimize image',
        error: error
      });
      throw error;
    }
  }

  async createThumbnail(buffer: Buffer, options: ThumbnailOptions = {}): Promise<ThumbnailResult> {
    try {
      const {
        width = this.thumbnailSize.width,
        height = this.thumbnailSize.height,
        quality = this.defaultQuality,
      } = options;

      const thumbnail = await sharp(buffer)
        .resize(width, height, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality })
        .toBuffer();
      
      logger.info(`Thumbnail created: ${width}x${height}`);
      
      return {
        buffer: thumbnail,
        width,
        height,
      };
    } catch (error) {
      logger.error({
        message: 'Failed to create thumbnail',
        error: error
      });
      throw error;
    }
  }

  async getMetadata(buffer: Buffer): Promise<ImageMetadata> {
    try {
      const metadata = await sharp(buffer).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: buffer.length,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation,
      };
    } catch (error) {
      logger.error({
        message: 'Failed to get image metadata',
        error: error
      });
      throw error;
    }
  }

  async autoRotate(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .rotate()
        .toBuffer();
    } catch (error) {
      logger.error({
        message: 'Failed to auto-rotate image',
        error: error
      });
      throw error;
    }
  }

  isOptimizableFormat(mimetype: string): boolean {
    const optimizableFormats = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/tiff',
      'image/gif',
    ];
    return optimizableFormats.includes(mimetype);
  }
}

export default ImageOptimizer;