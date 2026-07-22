/**
 * Shared helpers for API error bodies — especially membership term expiry
 * and stale JWT after role approval.
 */

export const TERM_EXPIRED_DEFAULT =
  'Sorry, your term has expired. To regain access, purchase a membership for the next term, then go to your Profile page and upload your payment receipt. An exec will review it and reactivate your account. If you have questions, email info@uoft-tri.club.';

export const STALE_TOKEN_DEFAULT =
  'Your membership was updated. Please log out and log back in to continue.';

export function isTermExpiredError(body) {
  return !!(body && body.error === 'term_expired');
}

export function isStaleTokenError(body) {
  return !!(body && body.error === 'stale_token');
}

/**
 * Prefer human-readable `message` for known membership errors; otherwise
 * fall back to message → error → fallback.
 */
export function getApiErrorMessage(body, fallback = 'Something went wrong. Please try again.') {
  if (!body || typeof body !== 'object') return fallback;
  if (isTermExpiredError(body)) return body.message || TERM_EXPIRED_DEFAULT;
  if (isStaleTokenError(body)) return body.message || STALE_TOKEN_DEFAULT;
  return body.message || body.error || fallback;
}

/** Parse JSON error body from a failed Response (safe if body is empty/non-JSON). */
export async function readApiError(response) {
  try {
    const clone = response.clone ? response.clone() : response;
    return await clone.json();
  } catch {
    return {};
  }
}

/**
 * Convenience: read body + friendly message from a failed Response.
 * @returns {Promise<{ body: object, message: string, isTermExpired: boolean, isStaleToken: boolean }>}
 */
export async function parseApiError(response, fallback) {
  const body = await readApiError(response);
  return {
    body,
    message: getApiErrorMessage(body, fallback),
    isTermExpired: isTermExpiredError(body),
    isStaleToken: isStaleTokenError(body),
  };
}
