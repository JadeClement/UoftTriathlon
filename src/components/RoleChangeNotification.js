import React from 'react';
import { useAuth } from '../context/AuthContext';
import './RoleChangeNotification.css';

/**
 * Shown when the user's DB role is ahead of their JWT (e.g. approved while still logged in).
 * Member APIs use the JWT role, so they must log out and back in for a fresh token.
 */
const RoleChangeNotification = () => {
  const { needsReauth, logout } = useAuth();

  if (!needsReauth) return null;

  const handleRelogin = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="role-change-notification" role="status" aria-live="polite">
      <div className="notification-content">
        <div className="notification-header">
          <h3>Membership updated</h3>
          <button type="button" className="close-button" onClick={handleRelogin} aria-label="Log out to refresh">
            ×
          </button>
        </div>
        <div className="notification-body">
          <p>
            Your account was updated (for example, your membership was approved), but this session is still using an old login token.
          </p>
          <p className="welcome-message">
            Please log out and log back in to unlock member features like ordering team gear.
          </p>
        </div>
        <div className="notification-actions">
          <button type="button" className="btn btn-primary" onClick={handleRelogin}>
            Log out and sign in again
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleChangeNotification;
