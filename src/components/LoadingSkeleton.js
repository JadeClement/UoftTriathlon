/**
 * Loading Skeleton Component
 * Provides skeleton loading states for better UX
 */

import React from 'react';
import './LoadingSkeleton.css';

export const PostSkeleton = () => (
  <div className="skeleton-post">
    <div className="skeleton-header">
      <div className="skeleton-avatar"></div>
      <div className="skeleton-text-group">
        <div className="skeleton-line skeleton-title"></div>
        <div className="skeleton-line skeleton-subtitle"></div>
      </div>
    </div>
    <div className="skeleton-content">
      <div className="skeleton-line"></div>
      <div className="skeleton-line"></div>
      <div className="skeleton-line skeleton-short"></div>
    </div>
  </div>
);

export const CardSkeleton = () => (
  <div className="skeleton-card">
    <div className="skeleton-line skeleton-title"></div>
    <div className="skeleton-line"></div>
    <div className="skeleton-line skeleton-short"></div>
  </div>
);

export const ListSkeleton = ({ count = 3 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skeleton-list-item">
        <div className="skeleton-avatar"></div>
        <div className="skeleton-text-group">
          <div className="skeleton-line"></div>
          <div className="skeleton-line skeleton-short"></div>
        </div>
      </div>
    ))}
  </>
);

export default PostSkeleton;

