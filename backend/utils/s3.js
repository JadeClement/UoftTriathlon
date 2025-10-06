// Temporary no-op S3 utils while S3 is disabled
function isS3Enabled() { return false; }
async function uploadBufferToS3() { throw new Error('S3 disabled'); }
async function deleteFromS3() { throw new Error('S3 disabled'); }
function getS3KeyFromUrl() { return null; }
const S3_PUBLIC_BASE_URL = undefined;

module.exports = { isS3Enabled, uploadBufferToS3, deleteFromS3, getS3KeyFromUrl, S3_PUBLIC_BASE_URL };


