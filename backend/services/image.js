import sharp from 'sharp';
import crypto from 'crypto';
import { uploadObject, deleteObject } from '../lib/s3.js';

/**
 * 이미지를 webp로 변환하고 RustFS에 업로드
 * @param {Buffer} buffer - 원본 이미지 버퍼
 * @returns {Promise<{path: string, width: number, height: number, size: number}>}
 */
export async function convertAndUpload(buffer) {
  const webpBuffer = await sharp(buffer)
    .webp({ quality: 90 })
    .toBuffer();

  const metadata = await sharp(webpBuffer).metadata();
  const hash = crypto.createHash('sha256').update(webpBuffer).digest('hex').slice(0, 16);
  const path = `common/${hash}.webp`;

  await uploadObject(path, webpBuffer, 'image/webp');

  return {
    path,
    width: metadata.width,
    height: metadata.height,
    size: webpBuffer.length,
  };
}

export async function deleteFromS3(path) {
  await deleteObject(path);
}
