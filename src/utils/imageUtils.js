// Utility to normalize profile image URLs across the app
// Handles full http(s) URLs (e.g., S3), '/api/...' and '/uploads/...' paths
export function normalizeProfileImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';
  const originBase = apiBase.replace(/\/api\/?$/, '');

  const url = rawUrl.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url; // Already absolute (e.g., S3)
  }
  if (url.startsWith('/api/')) {
    return `${originBase}${url}`;
  }
  if (url.startsWith('/uploads/')) {
    return `${apiBase}/..${url}`;
  }
  // Unknown shape
  return null;
}


