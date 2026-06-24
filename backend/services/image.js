import sharp from 'sharp';
import crypto from 'crypto';
import { uploadObject, deleteObject, copyObject } from '../lib/s3.js';

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

// 삭제 실패해도 흐름을 끊지 않는 버전 (이전 이미지 정리 등에 사용)
export async function safeDelete(path) {
  if (!path) return;
  try {
    await deleteObject(path);
  } catch (err) {
    console.warn(`S3 삭제 실패 (${path}):`, err.message);
  }
}

/**
 * S3 객체를 새 경로로 이동(copy 후 원본 삭제).
 * 성공 시 true, 실패 시 false 반환 — 실패해도 흐름을 끊지 않으며
 * 호출부는 기존 경로를 그대로 유지해 이미지 깨짐을 방지한다.
 * @param {string} srcPath - 원본 S3 키
 * @param {string} destPath - 대상 S3 키
 * @returns {Promise<boolean>}
 */
export async function safeRename(srcPath, destPath) {
  if (!srcPath || !destPath || srcPath === destPath) return false;
  try {
    await copyObject(srcPath, destPath);
    await safeDelete(srcPath);
    return true;
  } catch (err) {
    console.warn(`S3 이동 실패 (${srcPath} → ${destPath}):`, err.message);
    return false;
  }
}

/**
 * 지정한 경로로 webp 변환 후 업로드 (덮어쓰기)
 * @param {Buffer} buffer - 원본 이미지 버퍼
 * @param {string} path - S3 키 (확장자 포함). 예: 'symbol/아케인심볼(소멸의 여로).webp'
 */
export async function convertAndUploadTo(buffer, path) {
  const webpBuffer = await sharp(buffer).webp({ quality: 90 }).toBuffer();
  await uploadObject(path, webpBuffer, 'image/webp');
  return { path, size: webpBuffer.length };
}
