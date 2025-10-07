const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

// Support multiple env var names (Railway/Vercel/AWS conventions)
function getEnv(name, fallbackName) {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
}

const ACCESS_KEY = getEnv('AWS_S3_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID');
const SECRET_KEY = getEnv('AWS_S3_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY');
const REGION = getEnv('AWS_S3_REGION', 'AWS_REGION');
const BUCKET = getEnv('AWS_S3_BUCKET', 'S3_BUCKET');

function isS3Enabled() {
  return Boolean(ACCESS_KEY && SECRET_KEY && BUCKET && REGION);
}

const S3_PUBLIC_BASE_URL = process.env.AWS_S3_PUBLIC_BASE_URL || (BUCKET && REGION
  ? `https://${BUCKET}.s3.${REGION}.amazonaws.com`
  : undefined);

let s3Client = null;
function getClient() {
  if (!isS3Enabled()) throw new Error('S3 not configured');
  if (s3Client) return s3Client;
  s3Client = new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY
    }
  });
  return s3Client;
}

async function uploadBufferToS3(key, buffer, contentType) {
  const client = getClient();
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/octet-stream'
  }));
  if (!S3_PUBLIC_BASE_URL) throw new Error('No public base URL available for S3');
  return `${S3_PUBLIC_BASE_URL}/${key}`;
}

async function deleteFromS3(key) {
  const client = getClient();
  await client.send(new DeleteObjectCommand({
    Bucket: BUCKET,
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


