/**
 * Pull-to-Refresh Component
 * Provides pull-to-refresh functionality for mobile devices
 */

import React, { useState, useEffect, useRef } from 'react';
import { hapticImpact, hapticSuccess } from '../utils/haptics';
import './PullToRefresh.css';

const PullToRefresh = ({ onRefresh, children, disabled = false }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canPull, setCanPull] = useState(true);
  const startY = useRef(0);
  const currentY = useRef(0);
  const containerRef = useRef(null);

  const PULL_THRESHOLD = 80; // Distance in pixels to trigger refresh
  const MAX_PULL = 120; // Maximum pull distance

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

    const handleTouchStart = (e) => {
      // Only allow pull-to-refresh if at the top of the page
      if (container.scrollTop > 0) {
        setCanPull(false);
        return;
      }
      setCanPull(true);
      startY.current = e.touches[0].clientY;
      currentY.current = startY.current;
    };

    const handleTouchMove = (e) => {
      if (!canPull || disabled || isRefreshing) return;

      currentY.current = e.touches[0].clientY;
      const distance = currentY.current - startY.current;

      // Only allow pulling down
      if (distance > 0) {
        e.preventDefault(); // Prevent default scroll
        const pullAmount = Math.min(distance, MAX_PULL);
        setPullDistance(pullAmount);
        setIsPulling(pullAmount > 10);

        // Haptic feedback when crossing threshold
        if (pullAmount >= PULL_THRESHOLD && !isPulling) {
          hapticImpact();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!canPull || disabled || isRefreshing) return;

      if (pullDistance >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        hapticSuccess();
        
        try {
          await onRefresh();
        } catch (error) {
          console.error('Pull-to-refresh error:', error);
        } finally {
          // Reset after a short delay
          setTimeout(() => {
            setPullDistance(0);
            setIsPulling(false);
            setIsRefreshing(false);
          }, 300);
        }
      } else {
        // Snap back if not enough pull
        setPullDistance(0);
        setIsPulling(false);
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [canPull, disabled, isRefreshing, pullDistance, isPulling, onRefresh]);

  const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const shouldShowIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div 
      ref={containerRef}
      className="pull-to-refresh-container"
      style={{
        transform: `translateY(${Math.min(pullDistance, MAX_PULL)}px)`,
        transition: isRefreshing ? 'transform 0.3s ease' : 'none'
      }}
    >
      {shouldShowIndicator && (
        <div className="pull-to-refresh-indicator">
          <div 
            className="pull-to-refresh-spinner"
            style={{
              transform: `rotate(${pullProgress * 360}deg)`,
              opacity: pullProgress
            }}
          >
            {isRefreshing ? '🔄' : '⬇️'}
          </div>
          <div className="pull-to-refresh-text">
            {isRefreshing 
              ? 'Refreshing...' 
              : pullDistance >= PULL_THRESHOLD 
                ? 'Release to refresh' 
                : 'Pull to refresh'
            }
          </div>
        </div>
      )}
      {children}
    </div>
  );
};

export default PullToRefresh;

