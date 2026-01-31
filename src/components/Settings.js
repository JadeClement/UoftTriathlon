import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Capacitor } from '@capacitor/core';
import { showSuccess, showError } from './SimpleNotification';
import ConfirmModal from './ConfirmModal';
import './Settings.css';

const Settings = () => {
  const navigate = useNavigate();
  const { currentUser, isMember, updateUser } = useAuth();
  const isIOS = Capacitor.getPlatform() === 'ios';

  const [resultsPublic, setResultsPublic] = useState(false);
  const [racesPublic, setRacesPublic] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [accountActionLoading, setAccountActionLoading] = useState(false);

  // Notification preferences state
  const [notificationPrefs, setNotificationPrefs] = useState({
    spinBrickWorkouts: false,
    swimWorkouts: false,
    runWorkouts: false,
    events: false,
    forumReplies: false,
    waitlistPromotions: false
  });
  const [notificationPrefsLoading, setNotificationPrefsLoading] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

  useEffect(() => {
    // Settings page is iOS only - redirect if not on iOS
    if (!isIOS) {
      navigate('/profile');
      return;
    }

    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    if (!isMember(currentUser)) {
      navigate('/login');
      return;
    }

    loadNotificationPrefs();
    setResultsPublic(currentUser?.results_public ?? currentUser?.resultsPublic ?? false);
    setRacesPublic(currentUser?.races_public ?? currentUser?.racesPublic ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, navigate, isMember]);

  // Load notification preferences
  const loadNotificationPrefs = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/users/notification-preferences`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.preferences) {
          setNotificationPrefs({
            spinBrickWorkouts: data.preferences.spin_brick_workouts || false,
            swimWorkouts: data.preferences.swim_workouts || false,
            runWorkouts: data.preferences.run_workouts || false,
            events: data.preferences.events || false,
            forumReplies: data.preferences.forum_replies || false,
            waitlistPromotions: data.preferences.waitlist_promotions || false
          });
        }
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  };

  // Save notification preferences
  const saveNotificationPrefs = async (newPrefs) => {
    try {
      setNotificationPrefsLoading(true);
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/users/notification-preferences`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          preferences: {
            spin_brick_workouts: newPrefs.spinBrickWorkouts,
            swim_workouts: newPrefs.swimWorkouts,
            run_workouts: newPrefs.runWorkouts,
            events: newPrefs.events,
            forum_replies: newPrefs.forumReplies,
            waitlist_promotions: newPrefs.waitlistPromotions
          }
        })
      });
      if (response.ok) {
        setNotificationPrefs(newPrefs);
        showSuccess('Notification preferences saved!');
      } else {
        showError('Failed to save notification preferences');
      }
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      showError('Error saving notification preferences');
    } finally {
      setNotificationPrefsLoading(false);
    }
  };

  const savePrivacyPref = async (field, value) => {
    try {
      setPrivacyLoading(true);
      const token = localStorage.getItem('triathlonToken');
      const body = {
        name: currentUser?.name,
        email: currentUser?.email,
        phone_number: currentUser?.phone_number || currentUser?.phoneNumber,
        bio: currentUser?.bio,
        [field]: value
      };
      const res = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        if (field === 'results_public') setResultsPublic(value);
        if (field === 'races_public') setRacesPublic(value);
        updateUser({
          ...currentUser,
          results_public: field === 'results_public' ? value : (currentUser?.results_public ?? currentUser?.resultsPublic),
          resultsPublic: field === 'results_public' ? value : (currentUser?.results_public ?? currentUser?.resultsPublic),
          races_public: field === 'races_public' ? value : (currentUser?.races_public ?? currentUser?.racesPublic),
          racesPublic: field === 'races_public' ? value : (currentUser?.races_public ?? currentUser?.racesPublic)
        });
        showSuccess('Privacy setting saved!');
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to save');
      }
    } catch (err) {
      showError('Failed to save privacy setting');
    } finally {
      setPrivacyLoading(false);
    }
  };

  const handlePauseAccount = async () => {
    try {
      setAccountActionLoading(true);
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        showError('Not authenticated');
        return;
      }
      const resp = await fetch(`${API_BASE_URL}/users/profile/pause`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.ok) {
        localStorage.removeItem('triathlonUser');
        localStorage.removeItem('triathlonToken');
        window.location.href = '/login';
      } else {
        showError(data.error || 'Failed to pause account');
      }
    } catch (err) {
      showError(err.message || 'Failed to pause account');
    } finally {
      setAccountActionLoading(false);
      setShowPauseConfirm(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setAccountActionLoading(true);
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        showError('Not authenticated');
        return;
      }
      const resp = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.ok) {
        localStorage.removeItem('triathlonUser');
        localStorage.removeItem('triathlonToken');
        window.location.href = '/login';
      } else {
        showError(data.error || 'Failed to delete account');
      }
    } catch (err) {
      showError(err.message || 'Failed to delete account');
    } finally {
      setAccountActionLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  // Don't render Settings page if not on iOS
  if (!isIOS) {
    return null;
  }

  return (
    <div className="settings-container">
      <div className="container">
        <div className="settings-content">
          <h1 className="settings-title">Settings</h1>

          {/* Notification Preferences Section - iOS push only; no email opt-out exists */}
          <div className="settings-section">
            <h2 className="settings-section-title">Push Notification Preferences</h2>
            <p className="settings-section-description">
              Choose which push notifications you&apos;d like to receive in the iOS app. Emails (e.g. waitlist promotions, role changes) are always sent and cannot be turned off here.
            </p>

            <div className="settings-preferences">
              {/* Workout Types - One row */}
              <div className="settings-pref-row">
                <label className="settings-checkbox-label">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.spinBrickWorkouts}
                    onChange={(e) => {
                      const newPrefs = { ...notificationPrefs, spinBrickWorkouts: e.target.checked };
                      saveNotificationPrefs(newPrefs);
                    }}
                    disabled={notificationPrefsLoading}
                  />
                  <span>Spin/Brick Workouts</span>
                </label>
                <label className="settings-checkbox-label">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.swimWorkouts}
                    onChange={(e) => {
                      const newPrefs = { ...notificationPrefs, swimWorkouts: e.target.checked };
                      saveNotificationPrefs(newPrefs);
                    }}
                    disabled={notificationPrefsLoading}
                  />
                  <span>Swim Workouts</span>
                </label>
                <label className="settings-checkbox-label">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.runWorkouts}
                    onChange={(e) => {
                      const newPrefs = { ...notificationPrefs, runWorkouts: e.target.checked };
                      saveNotificationPrefs(newPrefs);
                    }}
                    disabled={notificationPrefsLoading}
                  />
                  <span>Run Workouts</span>
                </label>
              </div>

              {/* Other notifications */}
              <div className="settings-pref-row">
                <label className="settings-checkbox-label">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.events}
                    onChange={(e) => {
                      const newPrefs = { ...notificationPrefs, events: e.target.checked };
                      saveNotificationPrefs(newPrefs);
                    }}
                    disabled={notificationPrefsLoading}
                  />
                  <span>Events</span>
                </label>
                <label className="settings-checkbox-label">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.forumReplies}
                    onChange={(e) => {
                      const newPrefs = { ...notificationPrefs, forumReplies: e.target.checked };
                      saveNotificationPrefs(newPrefs);
                    }}
                    disabled={notificationPrefsLoading}
                  />
                  <span>Forum Replies</span>
                </label>
                <label className="settings-checkbox-label">
                  <input
                    type="checkbox"
                    checked={notificationPrefs.waitlistPromotions}
                    onChange={(e) => {
                      const newPrefs = { ...notificationPrefs, waitlistPromotions: e.target.checked };
                      saveNotificationPrefs(newPrefs);
                    }}
                    disabled={notificationPrefsLoading}
                  />
                  <span>Waitlist Promotions</span>
                </label>
              </div>
            </div>
          </div>

          {/* Privacy Section */}
          <div className="settings-section">
            <h2 className="settings-section-title">Privacy</h2>
            <p className="settings-section-description">
              Control what others can see on your profile.
            </p>
            <div className="settings-preferences">
              <label className="settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={resultsPublic}
                  onChange={(e) => savePrivacyPref('results_public', e.target.checked)}
                  disabled={privacyLoading}
                />
                <span>Show my interval results publicly</span>
              </label>
              <label className="settings-checkbox-label">
                <input
                  type="checkbox"
                  checked={racesPublic}
                  onChange={(e) => savePrivacyPref('races_public', e.target.checked)}
                  disabled={privacyLoading}
                />
                <span>Show my race signups publicly</span>
              </label>
            </div>
          </div>

          {/* Account Section */}
          <div className="settings-section">
            <h2 className="settings-section-title">Account</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center' }}>
              <div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPauseConfirm(true)}
                  disabled={accountActionLoading}
                  style={{ marginBottom: '0.5rem' }}
                >
                  Pause Account
                </button>
                <p className="settings-section-description" style={{ margin: 0, fontSize: '0.875rem' }}>
                  Move your account to pending status. Your data will be preserved, but you&apos;ll need to be approved again to regain access.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={accountActionLoading}
                  style={{ backgroundColor: '#dc2626', color: 'white', borderColor: '#dc2626' }}
                >
                  Delete Account
                </button>
                <p className="settings-section-description" style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
                  Permanently remove your account and all associated data.
                </p>
              </div>
            </div>
          </div>

          <ConfirmModal
            isOpen={showPauseConfirm}
            title="Pause Account"
            message="Are you sure you want to pause your account? Your account will be moved to pending status and you'll need to be approved again to regain access. All your data will be preserved."
            confirmText={accountActionLoading ? 'Pausing...' : 'Pause Account'}
            cancelText="Cancel"
            onConfirm={handlePauseAccount}
            onCancel={() => setShowPauseConfirm(false)}
          />

          {showDeleteConfirm && (
            <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', background: 'white', borderRadius: '12px', padding: '1.5rem' }}>
                <h2>Delete Account</h2>
                <p style={{ marginBottom: '1rem' }}>
                  Are you sure you want to permanently delete your account? All details, signups, and associated data will be permanently removed.
                </p>
                <p style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd', color: '#0369a1', fontSize: '0.9rem' }}>
                  <strong>Instead of deleting, you can pause your account</strong> to preserve all your progress and data.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" onClick={handlePauseAccount} disabled={accountActionLoading}>
                    Pause Account Instead
                  </button>
                  <button className="btn btn-danger" onClick={handleDeleteAccount} disabled={accountActionLoading} style={{ backgroundColor: '#dc2626', color: 'white', borderColor: '#dc2626' }}>
                    Delete Permanently
                  </button>
                  <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={accountActionLoading}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
