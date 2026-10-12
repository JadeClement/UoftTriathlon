import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Capacitor } from '@capacitor/core';
import { showSuccess, showError } from './SimpleNotification';
import ConfirmModal from './ConfirmModal';
import './Settings.css';
import { getApiBaseUrl } from '../utils/apiConfig';

const Settings = () => {
  const navigate = useNavigate();
  const { currentUser, isMember, updateUser } = useAuth();
  const isIOS = Capacitor.getPlatform() === 'ios';
  const isAndroid = Capacitor.getPlatform() === 'android';
  const isNativeApp = Capacitor.isNativePlatform();

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
    waitlistPromotions: false,
    smsEnabled: false,
    workoutReminderHours: 24
  });
  const [notificationPrefsLoading, setNotificationPrefsLoading] = useState(false);
  const [phoneInfo, setPhoneInfo] = useState({
    number: null,
    verified: false
  });
  const [smsConfigured, setSmsConfigured] = useState(true);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const API_BASE_URL = getApiBaseUrl();

  useEffect(() => {
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

  const loadNotificationPrefs = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/users/notification-preferences`, {
        headers: { Authorization: `Bearer ${token}` }
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
            waitlistPromotions: data.preferences.waitlist_promotions || false,
            smsEnabled: data.preferences.sms_enabled || false,
            workoutReminderHours: [1, 12, 24].includes(Number(data.preferences.workout_reminder_hours))
              ? Number(data.preferences.workout_reminder_hours)
              : 24
          });
        }
        if (data.phone) {
          setPhoneInfo({
            number: data.phone.number || null,
            verified: Boolean(data.phone.verified)
          });
        }
        setSmsConfigured(data.sms_configured !== false);
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  };

  const saveNotificationPrefs = async (newPrefs) => {
    try {
      setNotificationPrefsLoading(true);
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/users/notification-preferences`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          preferences: {
            spin_brick_workouts: newPrefs.spinBrickWorkouts,
            swim_workouts: newPrefs.swimWorkouts,
            run_workouts: newPrefs.runWorkouts,
            events: newPrefs.events,
            forum_replies: newPrefs.forumReplies,
            waitlist_promotions: newPrefs.waitlistPromotions,
            sms_enabled: newPrefs.smsEnabled,
            workout_reminder_hours: newPrefs.workoutReminderHours
          }
        })
      });
      if (response.ok) {
        setNotificationPrefs(newPrefs);
        showSuccess('Notification preferences saved!');
      } else {
        const err = await response.json().catch(() => ({}));
        showError(err.error || 'Failed to save notification preferences');
      }
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      showError('Error saving notification preferences');
    } finally {
      setNotificationPrefsLoading(false);
    }
  };

  const handleSendVerification = async () => {
    try {
      setOtpLoading(true);
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/users/phone/send-verification`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setOtpSent(true);
        showSuccess('Verification code sent by text');
      } else {
        showError(data.error || 'Failed to send verification code');
      }
    } catch (error) {
      showError('Failed to send verification code');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    try {
      setOtpLoading(true);
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/users/phone/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: otpCode })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setPhoneInfo((prev) => ({ ...prev, verified: true }));
        setOtpCode('');
        setOtpSent(false);
        updateUser({
          ...currentUser,
          phone_verified: true,
          phoneVerified: true
        });
        showSuccess('Phone number verified');
      } else {
        showError(data.error || 'Failed to verify code');
      }
    } catch (error) {
      showError('Failed to verify code');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSmsToggle = (checked) => {
    if (checked && !phoneInfo.verified) {
      showError('Verify your phone number before enabling SMS');
      return;
    }
    const newPrefs = { ...notificationPrefs, smsEnabled: checked };
    saveNotificationPrefs(newPrefs);
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

  return (
    <div className="settings-container">
      <div className="container">
        <div className="settings-content">
          <button
            type="button"
            className="settings-back-btn"
            onClick={() => navigate('/profile')}
          >
            ← Back to Profile
          </button>
          <h1 className="settings-title">Settings</h1>

          {/* Category preferences — shared by push (apps) and SMS */}
          <div className="settings-section">
            <h2 className="settings-section-title">Notification Categories</h2>
            <p className="settings-section-description">
              Choose what you want to be notified about.
              {isNativeApp
                ? ' These apply to push notifications on this device, and to SMS if you enable text alerts below.'
                : ' On the website these apply to SMS text alerts (enable below). Push notifications are available in the iOS and Android apps.'}
              {' '}
              Emails (e.g. waitlist promotions, role changes) are always sent and cannot be turned off here.
            </p>

            {isNativeApp && (
              <p className="settings-system-notice">
                {isIOS ? (
                  <>
                    If you aren&apos;t receiving push notifications, also turn them on in your phone&apos;s Settings:
                    {' '}
                    <strong>Settings → Notifications → UofT Triathlon</strong>
                    {' '}
                    (or search for the app), and enable Allow Notifications.
                  </>
                ) : isAndroid ? (
                  <>
                    If you aren&apos;t receiving push notifications, also turn them on in your phone&apos;s system settings:
                    {' '}
                    <strong>Settings → Apps → UofT Triathlon → Notifications</strong>
                    {' '}
                    and enable notifications for the app.
                  </>
                ) : (
                  <>
                    If you aren&apos;t receiving push notifications, also enable them for this app in your device&apos;s system Settings.
                  </>
                )}
              </p>
            )}

            <div className="settings-preferences">
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

          <div className="settings-section">
            <h2 className="settings-section-title">Workout Reminders</h2>
            <p className="settings-section-description">
              Get a reminder before workouts you have signed up for. This is separate from the
              category alerts above, which are for newly posted workouts. Reminders are sent as a
              push notification in the app, and by text if you enable SMS below.
            </p>
            <div className="settings-radio-group" role="radiogroup" aria-label="Workout reminder timing">
              {[
                { hours: 24, label: '24 hours before (default)' },
                { hours: 12, label: '12 hours before' },
                { hours: 1, label: '1 hour before' }
              ].map((option) => (
                <label className="settings-radio-label" key={option.hours}>
                  <input
                    type="radio"
                    name="workoutReminderHours"
                    value={option.hours}
                    checked={notificationPrefs.workoutReminderHours === option.hours}
                    onChange={() => {
                      const newPrefs = { ...notificationPrefs, workoutReminderHours: option.hours };
                      saveNotificationPrefs(newPrefs);
                    }}
                    disabled={notificationPrefsLoading}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* SMS / Twilio opt-in */}
          <div className="settings-section">
            <h2 className="settings-section-title">Text (SMS) Notifications</h2>
            <p className="settings-section-description">
              Opt in to receive text messages for the categories you selected above, and for workout reminders.
              {isNativeApp ? ' This is optional in addition to push notifications.' : ''}
              {' '}
              Message &amp; data rates may apply. Reply STOP to cancel texts from our number.
            </p>

            {!smsConfigured && (
              <p className="settings-system-notice">
                SMS is not configured on the server yet. Check back soon, or contact an exec.
              </p>
            )}

            <div className="settings-sms-block">
              <p className="settings-sms-phone">
                Phone on profile:{' '}
                <strong>{phoneInfo.number || 'Not set'}</strong>
                {phoneInfo.number && (
                  <>
                    {' · '}
                    {phoneInfo.verified ? (
                      <span className="settings-verified">Verified</span>
                    ) : (
                      <span className="settings-unverified">Not verified</span>
                    )}
                  </>
                )}
              </p>
              <p className="settings-section-description" style={{ marginBottom: '1rem' }}>
                Update your number on{' '}
                <Link to="/profile">Profile</Link>
                . Changing it requires re-verification and turns SMS off until you opt in again.
              </p>

              {phoneInfo.number && !phoneInfo.verified && smsConfigured && (
                <div className="settings-otp">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleSendVerification}
                    disabled={otpLoading}
                  >
                    {otpSent ? 'Resend code' : 'Send verification code'}
                  </button>
                  {otpSent && (
                    <div className="settings-otp-row">
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="6-digit code"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="settings-otp-input"
                        aria-label="Verification code"
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleVerifyCode}
                        disabled={otpLoading || otpCode.length !== 6}
                      >
                        Verify
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!phoneInfo.number && (
                <p className="settings-section-description">
                  Add a phone number on your <Link to="/profile">Profile</Link> to enable SMS.
                </p>
              )}

              <label className="settings-checkbox-label settings-sms-toggle">
                <input
                  type="checkbox"
                  checked={notificationPrefs.smsEnabled}
                  onChange={(e) => handleSmsToggle(e.target.checked)}
                  disabled={
                    notificationPrefsLoading ||
                    !smsConfigured ||
                    !phoneInfo.number ||
                    !phoneInfo.verified
                  }
                />
                <span>Enable SMS notifications</span>
              </label>
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
