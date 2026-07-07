import { useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { hapticSelection } from '../utils/haptics';
import {
  getDetailBackTarget,
  getMainTabSwipeTarget,
  shouldIgnoreSwipeTarget,
} from '../utils/swipeNavigation';

const SWIPE_THRESHOLD = 80;
const MAX_VERTICAL_DEVIATION = 60;

/**
 * Native-app horizontal swipe navigation:
 * - Main tabs: swipe left = next tab, swipe right = previous tab
 * - Detail pages: swipe right = go back to parent page
 */
export function useSwipeNavigation(navigate, location) {
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);
  const isNativeApp = Capacitor.isNativePlatform();

  const handleTouchStart = useCallback((e) => {
    if (!isNativeApp) return;
    if (!e.touches?.length) return;
    if (shouldIgnoreSwipeTarget(e.target)) return;

    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  }, [isNativeApp]);

  const handleTouchEnd = useCallback((e) => {
    if (!isNativeApp) return;
    if (touchStartXRef.current == null || touchStartYRef.current == null) return;
    if (!e.changedTouches?.length) return;
    if (shouldIgnoreSwipeTarget(e.target)) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    const isHorizontal =
      Math.abs(deltaX) > SWIPE_THRESHOLD &&
      Math.abs(deltaY) < MAX_VERTICAL_DEVIATION &&
      Math.abs(deltaX) > Math.abs(deltaY);

    if (!isHorizontal) return;

    const { pathname } = location;
    let target = null;

    if (deltaX > 0) {
      const backTarget = getDetailBackTarget(pathname);
      target = backTarget || getMainTabSwipeTarget(pathname, 'prev');
    } else {
      target = getMainTabSwipeTarget(pathname, 'next');
    }

    if (!target) return;

    const [targetPath, targetSearch = ''] = target.split('?');
    const currentPath = pathname;
    const currentSearch = location.search?.replace(/^\?/, '') || '';

    if (targetPath === currentPath && targetSearch === currentSearch) return;

    hapticSelection();
    navigate(target);
  }, [isNativeApp, location, navigate]);

  if (!isNativeApp) {
    return {};
  }

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  };
}
