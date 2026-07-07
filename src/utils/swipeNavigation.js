/** Bottom-nav tab order for horizontal swipe navigation (native apps). */
export const MAIN_TAB_ROUTES = ['/', '/join-us', '/forum', '/coaches-exec'];

const DETAIL_BACK_ROUTES = [
  { pattern: /^\/workout\/[^/]+$/, backTo: '/forum' },
  { pattern: /^\/event\/[^/]+$/, backTo: '/forum?tab=events' },
  { pattern: /^\/race\/[^/]+$/, backTo: '/races' },
  { pattern: /^\/profile\/[^/]+\/[^/]+$/, backTo: '/coaches-exec' },
];

export function getMainTabSwipeTarget(pathname, direction) {
  const index = MAIN_TAB_ROUTES.indexOf(pathname);
  if (index === -1) return null;

  const nextIndex = direction === 'next' ? index + 1 : index - 1;
  if (nextIndex < 0 || nextIndex >= MAIN_TAB_ROUTES.length) return null;

  return MAIN_TAB_ROUTES[nextIndex];
}

export function getDetailBackTarget(pathname) {
  for (const route of DETAIL_BACK_ROUTES) {
    if (route.pattern.test(pathname)) {
      return route.backTo;
    }
  }
  return null;
}

export function shouldIgnoreSwipeTarget(target) {
  if (!target?.closest) return false;

  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], .modal-overlay, .charter-overlay, [data-no-swipe-nav]'
    )
  );
}
