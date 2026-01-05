// Installs a global fetch wrapper that automatically handles auth errors
// - Attaches Authorization header if getToken() returns a token
// - If response is 401/403 or contains a token-expired style error, it calls onUnauthorized()

export function installFetchInterceptor(getToken, onUnauthorized) {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return () => {};

  // Prevent double installation
  if (window.__authFetchInstalled) {
    return window.__removeAuthFetch || (() => {});
  }

  const originalFetch = window.fetch.bind(window);

  async function authAwareFetch(input, init = {}) {
    try {
      const url = typeof input === 'string' ? input : input.url;
      
      // Don't intercept auth endpoints, role notifications, or merch orders to avoid redirect loops
      if (url && (
        url.includes('/auth/') || 
        url.includes('/users/role-change-notifications') ||
        url.includes('/users/mark-role-notification-read') ||
        url.includes('/merch-orders')
      )) {
        console.log('🔍 Fetch interceptor: Bypassing interceptor for URL:', url);
        return originalFetch(input, init);
      }
      
      const token = typeof getToken === 'function' ? getToken() : null;

      const headers = new Headers(init && init.headers ? init.headers : {});
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const response = await originalFetch(input, { ...init, headers });

      // Fast path: OK responses
      if (response.status < 400) return response;

      // Try to detect token problems
      let body;
      try {
        // Clone first so consumers can still read it later
        const clone = response.clone();
        body = await clone.json();
      } catch (_) {
        // ignore JSON parse errors
      }

      const isAuthError = response.status === 401 || response.status === 403;
      const message = (body && (body.error || body.message)) || '';
      const errorType = body && body.error;
      const mentionsExpired = /token.*expired|jwt.*expired|expired token/i.test(message);
      const isForumPermissionIssue = response.status === 403 && url && url.includes('/forum');
      
      // Don't treat term_expired as an auth error - it's a business logic error
      // The user IS authenticated, their term just expired
      const isTermExpired = errorType === 'term_expired';

      // Skip redirect for forum permission denials (pending/non-member)
      if ((isAuthError || mentionsExpired) && !isTermExpired && !isForumPermissionIssue) {
        console.warn('🔒 Auth interceptor: Unauthorized response detected', { 
          url, 
          status: response.status, 
          message,
          isAuthError,
          mentionsExpired,
          isTermExpired,
          isForumPermissionIssue
        });
        
        if (typeof onUnauthorized === 'function') {
          onUnauthorized({ status: response.status, message });
        }
      } else if (isTermExpired) {
        console.log('🔍 Auth interceptor: Term expired error detected, not redirecting (business logic error)');
      } else if (isForumPermissionIssue) {
        console.log('🔍 Auth interceptor: Forum permission error detected, not redirecting (pending/non-member)');
      }

      return response;
    } catch (err) {
      // Network errors fall through untouched
      throw err;
    }
  }

  window.fetch = authAwareFetch;
  window.__authFetchInstalled = true;
  window.__removeAuthFetch = () => {
    if (window.__authFetchInstalled) {
      window.fetch = originalFetch;
      window.__authFetchInstalled = false;
      delete window.__removeAuthFetch;
    }
  };

  return window.__removeAuthFetch;
}


