import sharp from 'sharp';
import logger from '../../../utils/logger.js';

interface PdfThumbnailResult {
  buffer: Buffer;
  width: number;
  height: number;
}

export async function generatePdfThumbnail(pdfBuffer: Buffer): Promise<PdfThumbnailResult> {
  const mupdf = await import('mupdf');

  const doc = mupdf.Document.openDocument(pdfBuffer, 'application/pdf');
  const page = doc.loadPage(0);
  const [, , w, h] = page.getBounds();

  // Render at 2x scale for crisp thumbnails
  const scale = Math.min(600 / w, 600 / h);
  const pixmap = page.toPixmap(
    mupdf.Matrix.scale(scale, scale),
    mupdf.ColorSpace.DeviceRGB,
    false, // no alpha
    true,  // annots
  );

  const rawPixels = pixmap.getPixels();
  const pxWidth = pixmap.getWidth();
  const pxHeight = pixmap.getHeight();

  const thumbnail = await sharp(Buffer.from(rawPixels), {
    raw: { width: pxWidth, height: pxHeight, channels: 3 },
  })
    .resize(300, 300, { fit: 'cover', position: 'top' })
    .webp({ quality: 80 })
    .toBuffer();

  logger.info(`PDF thumbnail generated: ${pxWidth}x${pxHeight} -> 300x300 WebP`);

  return { buffer: thumbnail, width: 300, height: 300 };
}
