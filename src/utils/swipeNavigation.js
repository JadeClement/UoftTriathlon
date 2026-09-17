/** Bottom-nav tab order for horizontal swipe navigation (native apps). */
export const MAIN_TAB_ROUTES = ['/', '/join-us', '/forum', '/coaches-exec'];

/**
 * Detail / leaf pages → parent route for:
 * - Android system back button
 * - Swipe-right back
 * - In-app "Back to …" buttons
 */
const DETAIL_BACK_ROUTES = [
  { pattern: /^\/workout\/[^/]+$/, backTo: '/forum', label: '← Back to Forum' },
  { pattern: /^\/event\/[^/]+$/, backTo: '/forum?tab=events', label: '← Back to Forum' },
  { pattern: /^\/race\/[^/]+$/, backTo: '/races', label: '← Back to Races' },
  { pattern: /^\/profile\/[^/]+\/[^/]+$/, backTo: '/coaches-exec', label: '← Back to Team' },
  { pattern: /^\/settings$/, backTo: '/profile', label: '← Back to Profile' },
  { pattern: /^\/results$/, backTo: '/profile', label: '← Back to Profile' },
  { pattern: /^\/reset-password$/, backTo: '/login', label: '← Back to Login' },
];

export function getMainTabSwipeTarget(pathname, direction) {
  const index = MAIN_TAB_ROUTES.indexOf(pathname);
  if (index === -1) return null;

  const nextIndex = direction === 'next' ? index + 1 : index - 1;
  if (nextIndex < 0 || nextIndex >= MAIN_TAB_ROUTES.length) return null;

  return MAIN_TAB_ROUTES[nextIndex];
}

/** @returns {string|null} parent path (may include query string) */
export function getDetailBackTarget(pathname) {
  for (const route of DETAIL_BACK_ROUTES) {
    if (route.pattern.test(pathname)) {
      return route.backTo;
    }
  }
  return null;
}

/** @returns {{ backTo: string, label: string }|null} */
export function getDetailBackNav(pathname) {
  for (const route of DETAIL_BACK_ROUTES) {
    if (route.pattern.test(pathname)) {
      return { backTo: route.backTo, label: route.label };
    }
  }
  return null;
}

export function navigateDetailBack(navigate, pathname) {
  const target = getDetailBackTarget(pathname);
  if (target) {
    navigate(target);
    return true;
  }
  return false;
}

export function shouldIgnoreSwipeTarget(target) {
  if (!target?.closest) return false;

  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], .modal-overlay, .charter-overlay, [data-no-swipe-nav]'
    )
  );
}
