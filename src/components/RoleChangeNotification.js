import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './RoleChangeNotification.css';

const RoleChangeNotification = ({ currentUser }) => {
  const { updateUser } = useAuth();
  const [notification, setNotification] = useState(null);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    // Check for role change notifications
    const checkNotifications = async () => {
      try {
        const token = localStorage.getItem('triathlonToken');
        if (!token) return;

        const response = await fetch('http://localhost:5001/api/users/role-change-notifications', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.hasNotification) {
            setNotification(data);
            setShowNotification(true);
            
            // Automatically update the user's session if role changed
            if (data.newRole !== currentUser.role) {
              console.log('🔄 Auto-updating user session from role', currentUser.role, 'to', data.newRole);
              
              // Show a message that the user needs to log out and back in
              alert(`🎉 Your role has been updated from ${currentUser.role} to ${data.newRole}!\n\nTo access your new permissions, please log out and log back in.`);
              
              // Force logout to get a new token with updated role
              localStorage.removeItem('triathlonUser');
              localStorage.removeItem('triathlonToken');
              window.location.reload();
            }
          }
        }
      } catch (error) {
        console.error('Error checking role change notifications:', error);
      }
    };

    checkNotifications();
    
    // Set up periodic checking every 30 seconds to catch role changes
    const interval = setInterval(checkNotifications, 30000);
    
    return () => clearInterval(interval);
  }, [currentUser, updateUser]);

  const handleDismiss = async () => {
    if (!notification) return;

    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) return;

      // Mark notification as read
      await fetch('http://localhost:5001/api/users/mark-role-notification-read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Update the user's session with the new role
      if (notification.newRole !== currentUser.role) {
        console.log('🔄 Updating user session from role', currentUser.role, 'to', notification.newRole);
        
        // Show a message that the user needs to log out and back in
        alert(`🎉 Your role has been updated from ${currentUser.role} to ${notification.newRole}!\n\nTo access your new permissions, please log out and log back in.`);
        
        // Force logout to get a new token with updated role
        localStorage.removeItem('triathlonUser');
        localStorage.removeItem('triathlonToken');
        window.location.reload();
      }

      setShowNotification(false);
      setNotification(null);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  if (!showNotification || !notification) return null;

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'pending': return 'Pending Member';
      case 'member': return 'Member';
      case 'exec': return 'Executive';
      case 'administrator': return 'Administrator';
      default: return role;
    }
  };

  return (
    <div className="role-change-notification">
      <div className="notification-content">
        <div className="notification-header">
          <h3>🎉 Role Updated!</h3>
          <button className="close-button" onClick={handleDismiss}>×</button>
        </div>
        <div className="notification-body">
          <p>
            Your role has been updated from <strong>{getRoleDisplayName(notification.oldRole)}</strong> to{' '}
            <strong>{getRoleDisplayName(notification.newRole)}</strong>.
          </p>
          {notification.newRole === 'member' && (
            <p className="welcome-message">
              Welcome to the club! You now have access to all member features.
            </p>
          )}
          <p className="timestamp">
            Updated on {new Date(notification.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="notification-actions">
          <button className="btn btn-primary" onClick={handleDismiss}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleChangeNotification;
