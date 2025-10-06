const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const S3_BUCKET = process.env.S3_BUCKET;
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
const S3_PUBLIC_BASE_URL = process.env.S3_PUBLIC_BASE_URL || (S3_BUCKET && AWS_REGION ? `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com` : undefined);

let s3Client = null;
if (S3_BUCKET && AWS_REGION) {
  s3Client = new S3Client({ region: AWS_REGION });
}

function isS3Enabled() {
  return !!(s3Client && S3_BUCKET && AWS_REGION && S3_PUBLIC_BASE_URL);
}

async function uploadBufferToS3(key, buffer, mimetype) {
  if (!isS3Enabled()) throw new Error('S3 is not configured');
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
    ACL: 'public-read',
  }));
  return `${S3_PUBLIC_BASE_URL}/${key}`;
}

async function deleteFromS3(key) {
  if (!isS3Enabled()) throw new Error('S3 is not configured');
  await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}

function getS3KeyFromUrl(url) {
  if (!url) return null;
  if (S3_PUBLIC_BASE_URL && url.startsWith(S3_PUBLIC_BASE_URL)) {
    return url.substring(S3_PUBLIC_BASE_URL.length + 1);
  }
  // Local-style fallback: /uploads/gear/filename
  if (url.startsWith('/uploads/')) {
    return url.replace(/^\//, '');
  }
  return null;
}

module.exports = { isS3Enabled, uploadBufferToS3, deleteFromS3, getS3KeyFromUrl, S3_PUBLIC_BASE_URL };


