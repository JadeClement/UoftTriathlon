import React, { useState, useEffect } from 'react';
import './SimpleNotification.css';

let showNotificationGlobal = null;

// Simple notification component
const SimpleNotification = () => {
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    showNotificationGlobal = (message, type = 'info') => {
      setNotification({ message, type, id: Date.now() });
      
      // Auto-hide after 4 seconds
      setTimeout(() => {
        setNotification(null);
      }, 4000);
    };
  }, []);

  if (!notification) return null;

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className={`simple-notification simple-notification-${notification.type}`}>
      <span className="notification-icon">{getIcon()}</span>
      <span className="notification-message">{notification.message}</span>
      <button 
        className="notification-close" 
        onClick={() => setNotification(null)}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
};

// Export functions to show notifications
export const showSuccess = (message) => {
  if (showNotificationGlobal) showNotificationGlobal(message, 'success');
};

export const showError = (message) => {
  if (showNotificationGlobal) showNotificationGlobal(message, 'error');
};

export const showWarning = (message) => {
  if (showNotificationGlobal) showNotificationGlobal(message, 'warning');
};

export const showInfo = (message) => {
  if (showNotificationGlobal) showNotificationGlobal(message, 'info');
};

export default SimpleNotification;
