import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Capacitor } from '@capacitor/core';
import { showSuccess, showError } from './SimpleNotification';
import { syncWorkoutsToCalendar } from '../services/calendarSyncService';
import './Settings.css';

const Settings = () => {
  const navigate = useNavigate();
  const { currentUser, isMember } = useAuth();
  const isIOS = Capacitor.getPlatform() === 'ios';

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

  // Calendar preferences state (iOS only)
  const [calendarPrefs, setCalendarPrefs] = useState({
    tuesdaySwim: false,
    tuesdayTrack: false,
    thursdaySwim: false,
    thursdayRun: false,
    sundaySwim: false
  });
  const [calendarPrefsLoading, setCalendarPrefsLoading] = useState(false);

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
    loadCalendarPrefs();
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

  // Load calendar preferences (iOS only)
  const loadCalendarPrefs = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/users/calendar-preferences`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.preferences) {
          setCalendarPrefs({
            tuesdaySwim: data.preferences.tuesday_swim || false,
            tuesdayTrack: data.preferences.tuesday_track || false,
            thursdaySwim: data.preferences.thursday_swim || false,
            thursdayRun: data.preferences.thursday_run || false,
            sundaySwim: data.preferences.sunday_swim || false
          });
        }
      } else if (response.status === 404) {
        // No preferences exist yet, that's fine
        console.log('No calendar preferences found, using defaults');
      }
    } catch (error) {
      console.error('Error loading calendar preferences:', error);
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

  // Save calendar preferences (iOS only)
  const saveCalendarPrefs = async (newPrefs, wasEnabled = false) => {
    try {
      setCalendarPrefsLoading(true);
      const token = localStorage.getItem('triathlonToken');
      
      const url = `${API_BASE_URL}/users/calendar-preferences`;
      const body = {
        preferences: {
          tuesday_swim: newPrefs.tuesdaySwim,
          tuesday_track: newPrefs.tuesdayTrack,
          thursday_swim: newPrefs.thursdaySwim,
          thursday_run: newPrefs.thursdayRun,
          sunday_swim: newPrefs.sundaySwim
        }
      };
      
      console.log('📅 Frontend: Attempting to save calendar preferences');
      console.log('📅 Frontend: URL:', url);
      console.log('📅 Frontend: Method: PUT');
      console.log('📅 Frontend: Body:', JSON.stringify(body));
      console.log('📅 Frontend: Token present:', !!token);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      console.log('📅 Frontend: Response status:', response.status);
      console.log('📅 Frontend: Response ok:', response.ok);
      
      const responseText = await response.text();
      console.log('📅 Frontend: Response text:', responseText);
      
      if (response.ok) {
        const responseData = JSON.parse(responseText);
        console.log('📅 Frontend: Response data:', responseData);
        setCalendarPrefs(newPrefs);
        showSuccess('Calendar preferences saved!');
        
        // If a preference was just enabled, sync existing matching workouts
        if (wasEnabled) {
          try {
            const result = await syncWorkoutsToCalendar();
            if (result.synced > 0) {
              showSuccess(`Added ${result.synced} workout(s) to your calendar!`);
            }
          } catch (error) {
            console.error('Error syncing workouts:', error);
            // Don't show error to user, just log it
          }
        }
      } else {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = { error: responseText || 'Unknown error' };
        }
        console.error('📅 Frontend: Failed to save calendar preferences');
        console.error('📅 Frontend: Status:', response.status);
        console.error('📅 Frontend: Error data:', errorData);
        showError(errorData.error || 'Failed to save calendar preferences');
      }
    } catch (error) {
      console.error('Error saving calendar preferences:', error);
      showError(error.message || 'Error saving calendar preferences');
    } finally {
      setCalendarPrefsLoading(false);
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

          {/* Notification Preferences Section */}
          <div className="settings-section">
            <h2 className="settings-section-title">Notification Preferences</h2>
            <p className="settings-section-description">
              Choose which types of notifications you'd like to receive.
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

          {/* Calendar Preferences Section - iOS only */}
          {isIOS && (
            <div className="settings-section">
              <h2 className="settings-section-title">Calendar Settings</h2>
              <p className="settings-section-description">
                Automatically add these recurring workouts to your calendar.
              </p>

              <div className="settings-preferences">
                <label className="settings-checkbox-label">
                  <input
                    type="checkbox"
                    checked={calendarPrefs.tuesdaySwim}
                    onChange={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const wasEnabled = calendarPrefs.tuesdaySwim;
                      const newPrefs = { ...calendarPrefs, tuesdaySwim: e.target.checked };
                      saveCalendarPrefs(newPrefs, !wasEnabled && e.target.checked);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    disabled={calendarPrefsLoading}
                  />
                  <span onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}>Tuesday Swim</span>
                </label>
                <label className="settings-checkbox-label">
                  <input
                    type="checkbox"
                    checked={calendarPrefs.tuesdayTrack}
                    onChange={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const wasEnabled = calendarPrefs.tuesdayTrack;
                      const newPrefs = { ...calendarPrefs, tuesdayTrack: e.target.checked };
                      saveCalendarPrefs(newPrefs, !wasEnabled && e.target.checked);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    disabled={calendarPrefsLoading}
                  />
                  <span onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}>Tuesday Track</span>
                </label>
                <label className="settings-checkbox-label">
                  <input
                    type="checkbox"
                    checked={calendarPrefs.thursdaySwim}
                    onChange={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const wasEnabled = calendarPrefs.thursdaySwim;
                      const newPrefs = { ...calendarPrefs, thursdaySwim: e.target.checked };
                      saveCalendarPrefs(newPrefs, !wasEnabled && e.target.checked);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    disabled={calendarPrefsLoading}
                  />
                  <span onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}>Thursday Swim</span>
                </label>
                <label className="settings-checkbox-label">
                  <input
                    type="checkbox"
                    checked={calendarPrefs.thursdayRun}
                    onChange={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const wasEnabled = calendarPrefs.thursdayRun;
                      const newPrefs = { ...calendarPrefs, thursdayRun: e.target.checked };
                      saveCalendarPrefs(newPrefs, !wasEnabled && e.target.checked);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    disabled={calendarPrefsLoading}
                  />
                  <span onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}>Thursday Run</span>
                </label>
                <label className="settings-checkbox-label">
                  <input
                    type="checkbox"
                    checked={calendarPrefs.sundaySwim}
                    onChange={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const wasEnabled = calendarPrefs.sundaySwim;
                      const newPrefs = { ...calendarPrefs, sundaySwim: e.target.checked };
                      saveCalendarPrefs(newPrefs, !wasEnabled && e.target.checked);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    disabled={calendarPrefsLoading}
                  />
                  <span onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}>Sunday Swim</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
