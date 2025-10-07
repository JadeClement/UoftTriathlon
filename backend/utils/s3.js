const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

function isS3Enabled() {
  return Boolean(
    process.env.AWS_S3_ACCESS_KEY_ID &&
    process.env.AWS_S3_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET &&
    process.env.AWS_S3_REGION
  );
}

const S3_PUBLIC_BASE_URL = process.env.AWS_S3_PUBLIC_BASE_URL || (process.env.AWS_S3_BUCKET && process.env.AWS_S3_REGION
  ? `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_S3_REGION}.amazonaws.com`
  : undefined);

let s3Client = null;
function getClient() {
  if (!isS3Enabled()) throw new Error('S3 not configured');
  if (s3Client) return s3Client;
  s3Client = new S3Client({
    region: process.env.AWS_S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY
    }
  });
  return s3Client;
}

async function uploadBufferToS3(key, buffer, contentType) {
  const client = getClient();
  await client.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream',
    ACL: 'public-read'
  }));
  if (!S3_PUBLIC_BASE_URL) throw new Error('No public base URL available for S3');
  return `${S3_PUBLIC_BASE_URL}/${key}`;
}

async function deleteFromS3(key) {
  const client = getClient();
  await client.send(new DeleteObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key
  }));
}

function getS3KeyFromUrl(url) {
  if (!url) return null;
  if (S3_PUBLIC_BASE_URL && url.startsWith(S3_PUBLIC_BASE_URL)) {
    return url.substring(S3_PUBLIC_BASE_URL.length + 1);
  }
  try {
    const u = new URL(url);
    // Assume path after bucket host is the key
    return u.pathname.replace(/^\//, '');
  } catch (_) {
    return null;
  }
}

module.exports = { isS3Enabled, uploadBufferToS3, deleteFromS3, getS3KeyFromUrl, S3_PUBLIC_BASE_URL };


