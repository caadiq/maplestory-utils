import { S3Client, PutObjectCommand, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';

export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

export const S3_BUCKET = process.env.S3_BUCKET;
export const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL;

export async function uploadObject(key, body, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

export async function deleteObject(key) {
  await s3.send(new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  }));
}

export async function copyObject(srcKey, destKey) {
  // CopySource는 `bucket/key` 형식이며, 한글·특수문자 키는 세그먼트별 URL 인코딩 필요
  const copySource = `${S3_BUCKET}/${srcKey}`.split('/').map(encodeURIComponent).join('/');
  await s3.send(new CopyObjectCommand({
    Bucket: S3_BUCKET,
    CopySource: copySource,
    Key: destKey,
  }));
}

export function getPublicUrl(key) {
  return `${S3_PUBLIC_URL}/${S3_BUCKET}/${key}`;
}
