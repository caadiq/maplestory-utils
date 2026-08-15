import { S3Client, PutObjectCommand, DeleteObjectCommand, CopyObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

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

/**
 * 객체를 읽어온다 (스트림).
 * 오디오는 브라우저가 fetch + decodeAudioData로 읽어야 해서 CORS가 필요한데,
 * S3에는 CORS 헤더가 없다. 백엔드가 같은 오리진으로 내주면 그 문제가 사라진다.
 */
export async function getObjectStream(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  return { body: res.Body, contentType: res.ContentType, contentLength: res.ContentLength };
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
