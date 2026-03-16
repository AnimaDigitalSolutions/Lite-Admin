import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import logger from '../../../utils/logger.js';

interface VideoThumbnailResult {
  buffer: Buffer;
  width: number;
  height: number;
}

export async function generateVideoThumbnail(videoFilePath: string): Promise<VideoThumbnailResult> {
  const tmpDir = tmpdir();
  const frameName = `frame-${nanoid(8)}.png`;
  const framePath = path.join(tmpDir, frameName);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoFilePath)
      .seekInput(1) // 1 second in
      .frames(1)
      .outputOptions('-update', '1')
      .output(framePath)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .run();
  });

  const frameBuffer = await fs.readFile(framePath);

  // Clean up temp file
  await fs.unlink(framePath).catch(() => {});

  const thumbnail = await sharp(frameBuffer)
    .resize(300, 300, { fit: 'cover', position: 'center' })
    .webp({ quality: 80 })
    .toBuffer();

  logger.info('Video thumbnail generated: 300x300 WebP');

  return { buffer: thumbnail, width: 300, height: 300 };
}
