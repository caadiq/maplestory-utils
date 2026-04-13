import sharp from 'sharp';
import { uploadObject, deleteObject } from '../../lib/s3.js';

const BOSS_IMAGE_PREFIX = 'crystal/boss';

/**
 * 보스 이미지를 webp로 변환하고 RustFS의 crystal/boss/{name}.webp에 업로드
 * @param {Buffer} buffer
 * @param {string} bossName
 * @returns {Promise<string>} S3 키 (예: crystal/boss/검은마법사.webp)
 */
export async function uploadBossImage(buffer, bossName) {
  const webp = await sharp(buffer).webp({ quality: 90 }).toBuffer();
  const path = `${BOSS_IMAGE_PREFIX}/${bossName}.webp`;
  await uploadObject(path, webp, 'image/webp');
  return path;
}

export async function deleteBossImage(path) {
  if (!path) return;
  try {
    await deleteObject(path);
  } catch (err) {
    console.warn(`보스 이미지 삭제 실패 (${path}):`, err.message);
  }
}
