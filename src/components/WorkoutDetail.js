// Force fresh Vercel build - clear build cache
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkoutEdit } from '../hooks/useWorkoutEdit';
import { useWorkout, useOnlineStatus } from '../hooks/useOfflineData';
import { linkifyText } from '../utils/linkUtils';
import { combineDateTime, getHoursUntil, isWithinHours, formatSignupDateForDisplay, formatSignupTimeOnlyForDisplay } from '../utils/dateUtils';
import { normalizeProfileImageUrl } from '../utils/imageUtils';
import { showSuccess, showError, showWarning } from './SimpleNotification';
import ConfirmModal from './ConfirmModal';
import { Capacitor } from '@capacitor/core';
import { addWorkoutToCalendar } from '../services/calendarService';
import './WorkoutDetail.css';

const WorkoutDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isMember } = useAuth();
  const isIOS = Capacitor.isNativePlatform && Capacitor.isNativePlatform() && Capacitor.getPlatform && Capacitor.getPlatform() === 'ios';
  
  // Offline data hooks
  const isOnline = useOnlineStatus();
  const {
    workout: cachedWorkout,
    signups: cachedSignups,
    waitlist: cachedWaitlist,
    loading: workoutLoading,
    fromCache: workoutFromCache,
    refresh: refreshWorkout
  } = useWorkout(id);
  
  // Use cached data if available, otherwise use state
  const [workout, setWorkout] = useState(null);
  const [signups, setSignups] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [isOnWaitlist, setIsOnWaitlist] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isInCalendar, setIsInCalendar] = useState(false);
  const [checkingCalendar, setCheckingCalendar] = useState(false);
  const [attendance, setAttendance] = useState({});
  const [lateStatus, setLateStatus] = useState({});
  const [attendanceSaved, setAttendanceSaved] = useState(false);
  const [submittingAttendance, setSubmittingAttendance] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState(false);
  const [swimMembers, setSwimMembers] = useState([]);
  const [isSwimWorkout, setIsSwimWorkout] = useState(false);
  const [workoutIntervals, setWorkoutIntervals] = useState([]);
  const [intervalResults, setIntervalResults] = useState([]);
  const [showIntervalResultModal, setShowIntervalResultModal] = useState(false);
  const [intervalResultForm, setIntervalResultForm] = useState({}); // { interval_id: time }
  const [showAddIntervalModal, setShowAddIntervalModal] = useState(false);
  const [addIntervalForm, setAddIntervalForm] = useState({ title: '', description: '' });
  const [deleteIntervalConfirm, setDeleteIntervalConfirm] = useState({ isOpen: false, intervalId: null });
  const [deletingIntervalId, setDeletingIntervalId] = useState(null);

  // Swipe-to-go-back gesture (iOS only)
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    if (!isIOS) return;
    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  }, [isIOS]);

  const handleTouchEnd = useCallback((e) => {
    if (!isIOS) return;
    if (touchStartXRef.current == null || touchStartYRef.current == null) return;
    if (!e.changedTouches || e.changedTouches.length === 0) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    // Reset for next gesture
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Only trigger if swipe starts near left edge and is mostly horizontal
    const EDGE_THRESHOLD = 40; // px from left edge
    const SWIPE_THRESHOLD = 80; // minimum horizontal distance
    const MAX_VERTICAL_DEVIATION = 60; // allow some vertical movement

    if (touch.clientX <= 0) return; // ignore weird events

    const startedNearEdge = (touch.clientX - deltaX) <= EDGE_THRESHOLD;
    const isHorizontal = Math.abs(deltaY) < MAX_VERTICAL_DEVIATION;
    const isRightSwipe = deltaX > SWIPE_THRESHOLD;

    if (startedNearEdge && isHorizontal && isRightSwipe) {
      // Use the same navigation as the Back button
      navigate('/forum');
    }
  }, [isIOS, navigate]);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';
  
  const { 
    editForm, 
    saving, 
    startEdit, 
    cancelEdit, 
    updateField, 
    saveWorkout 
  } = useWorkoutEdit(API_BASE_URL);
  
  const [editMode, setEditMode] = useState(false);

  const isCoachOrAdmin = currentUser && (currentUser.role === 'coach' || currentUser.role === 'administrator');

  // Define loader before effects to avoid temporal dead zone
  const loadWorkoutDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        const errorMsg = 'No authentication token found. Please log in.';
        console.error(errorMsg);
        setError(errorMsg);
        setLoading(false);
        return;
      }

      // Validate workout ID
      if (!id || isNaN(parseInt(id))) {
        const errorMsg = 'Invalid workout ID';
        console.error(errorMsg);
        setError(errorMsg);
        setLoading(false);
        return;
      }

      // Load workout details
      const workoutResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (workoutResponse.ok) {
        const workoutData = await workoutResponse.json();

        if (!workoutData.workout) {
          throw new Error('Workout data not found in response');
        }
        
        setWorkout(workoutData.workout);
        setSignups(workoutData.signups || []);
        setWaitlist(workoutData.waitlist || []);
        setError(null);
        
        // Check if this is a swim workout and user is exec/admin
        const isSwim = workoutData.workout?.workout_type === 'swim';
        const isExec = currentUser?.role === 'exec' || currentUser?.role === 'administrator' || currentUser?.role === 'coach';
        setIsSwimWorkout(isSwim);
        
        // Load swim members if this is a swim workout and user is exec/admin
        if (isSwim && isExec) {
          try {
            const swimMembersResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}/attendance-members`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (swimMembersResponse.ok) {
              const swimMembersData = await swimMembersResponse.json();
              setSwimMembers(swimMembersData.members || []);
            } else {
              console.error('❌ Failed to load swim members:', swimMembersResponse.status);
            }
          } catch (swimError) {
            console.error('❌ Error loading swim members:', swimError);
            // Don't fail the whole page if swim members fail to load
          }
        }
      } else {
        const errorText = await workoutResponse.text().catch(() => 'Unknown error');
        let errorMsg = `Failed to load workout: ${workoutResponse.status}`;
        
        // Check if offline and show appropriate message
        if (!navigator.onLine) {
          errorMsg = 'You are offline. This workout cannot be loaded. Please check your internet connection.';
        } else if (workoutResponse.status === 404) {
          errorMsg = 'Workout not found. It may have been deleted.';
        } else if (workoutResponse.status === 401) {
          errorMsg = 'Authentication required. Please log in.';
        } else if (workoutResponse.status === 403) {
          errorMsg = 'You do not have permission to view this workout.';
        }
        
        console.error('❌ Failed to load workout details:', workoutResponse.status, workoutResponse.statusText, errorText);
        setError(errorMsg);
      }

      // Check if attendance has already been submitted
      const attendanceResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}/attendance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (attendanceResponse.ok) {
        const attendanceData = await attendanceResponse.json();
        setAttendanceSaved(attendanceData.attendance && attendanceData.attendance.length > 0);
        
        // Process attendance and late status
        if (attendanceData.attendance && attendanceData.attendance.length > 0) {
          const attendanceMap = {};
          const lateMap = {};
          attendanceData.attendance.forEach(record => {
            attendanceMap[record.user_id] = record.attended;
            lateMap[record.user_id] = record.late || false;
          });
          setAttendance(attendanceMap);
          setLateStatus(lateMap);
        }
      } else {
        setAttendanceSaved(false);
      }

      // Load signups
      const signupsResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}/signups`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (signupsResponse.ok) {
        const signupsData = await signupsResponse.json();
        setSignups(signupsData.signups);
        
        // Check if current user is signed up
        const userSignup = signupsData.signups.find(s => s.user_id === currentUser.id);
        setIsSignedUp(!!userSignup);
      }

      // Load waitlist
      const waitlistResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}/waitlist`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (waitlistResponse.ok) {
        const waitlistData = await waitlistResponse.json();
        setWaitlist(waitlistData.waitlist);
        
        // Check if current user is on waitlist
        const userWaitlist = waitlistData.waitlist.find(w => w.user_id === currentUser.id);
        setIsOnWaitlist(!!userWaitlist);
      }

      // Load comments
      try {
        const commentsResponse = await fetch(`${API_BASE_URL}/forum/posts/${id}/comments`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (commentsResponse.ok) {
          const commentsData = await commentsResponse.json();
          setComments(commentsData.comments || []);
        } else {
          setComments([]);
        }
      } catch (error) {
        console.error('Error loading comments:', error);
        setComments([]);
      }

      // Load intervals and interval results for all members (web + iOS)
      const shouldLoadIntervals = !!currentUser;
      const shouldLoadIntervalResults = currentUser && (isMember(currentUser) || ['coach', 'administrator', 'exec'].includes(currentUser.role || ''));
      if (shouldLoadIntervals) {
        const intervalsRes = await fetch(`${API_BASE_URL}/forum/workouts/${id}/intervals`, { headers: { Authorization: `Bearer ${token}` } });
        if (intervalsRes.ok) {
          const intervalsData = await intervalsRes.json();
          setWorkoutIntervals(intervalsData.intervals || []);
        }
      }
      if (shouldLoadIntervalResults) {
        const resultsRes = await fetch(`${API_BASE_URL}/forum/workouts/${id}/interval-results`, { headers: { Authorization: `Bearer ${token}` } });
        if (resultsRes.ok) {
          const resultsData = await resultsRes.json();
          setIntervalResults(resultsData.intervalResults || []);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('❌ Error loading workout details:', error);
      // Check if offline and show appropriate message
      if (!navigator.onLine) {
        setError('You are offline. This workout cannot be loaded. Please check your internet connection.');
      } else {
        setError(error.message || 'Failed to load workout details. Please try again.');
      }
      setLoading(false);
    }
  }, [API_BASE_URL, id, currentUser, isMember]);

  // eslint-disable-next-line no-unused-vars
  const isWorkoutArchived = () => {
    try {
      const workoutToCheck = displayWorkout || workout;
      if (!workoutToCheck || !workoutToCheck.workout_date) return false;
      
      // Parse the workout date and get just the date part (YYYY-MM-DD)
      const workoutDate = new Date(workoutToCheck.workout_date);
      if (isNaN(workoutDate.getTime())) return false;
      
      // Get today's date
      const today = new Date();
      
      // Compare dates by converting both to YYYY-MM-DD format
      const workoutDateStr = workoutDate.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];
      
      return workoutDateStr < todayStr;
    } catch (_) {
      return false;
    }
  };

  // Check if workout has started (date + time is in the past)
  const isWorkoutStarted = () => {
    try {
      const workoutToCheck = displayWorkout || workout;
      if (!workoutToCheck || !workoutToCheck.workout_date || !workoutToCheck.workout_time) {
        return false;
      }
      
      // Extract just the date part if workout_date is an ISO string
      let dateStr = workoutToCheck.workout_date;
      if (typeof dateStr === 'string' && dateStr.includes('T')) {
        dateStr = dateStr.split('T')[0];
      }
      
      // Use combineDateTime to get the workout datetime in EST/EDT
      const workoutDateTime = combineDateTime(dateStr, workoutToCheck.workout_time);
      if (!workoutDateTime) {
        return false;
      }
      
      // Compare workout datetime to current time
      const now = new Date();
      return workoutDateTime < now;
    } catch (error) {
      console.error('Error checking if workout started:', error);
      return false;
    }
  };

  // Helpers for waitlist position display
  const getWaitlistPosition = () => {
    const waitlistToCheck = displayWaitlist.length > 0 ? displayWaitlist : waitlist;
    const idx = waitlistToCheck.findIndex(w => w.user_id === currentUser.id);
    return idx === -1 ? null : idx + 1;
  };

  const formatOrdinal = (n) => {
    if (n == null) return '';
    const s = ["th","st","nd","rd"], v = n % 100;
    return n + (s[(v-20)%10] || s[v] || s[0]);
  };

  // Sync cached workout data to state
  /* eslint-disable no-use-before-define */
  useEffect(() => {
    if (cachedWorkout) {
      setWorkout(cachedWorkout);
    }
    if (cachedSignups && cachedSignups.length > 0) {
      setSignups(cachedSignups);
      // Check if current user is signed up
      const userSignup = cachedSignups.find(s => s.user_id === currentUser?.id);
      setIsSignedUp(!!userSignup);
    }
    if (cachedWaitlist && cachedWaitlist.length > 0) {
      setWaitlist(cachedWaitlist);
      // Check if current user is on waitlist
      const userWaitlist = cachedWaitlist.find(w => w.user_id === currentUser?.id);
      setIsOnWaitlist(!!userWaitlist);
    }
    // Update loading state based on workout hook
    if (!workoutLoading) {
      setLoading(false);
    }
  }, [cachedWorkout, cachedSignups, cachedWaitlist, workoutLoading, currentUser]);

  // Track if we've loaded workout details to prevent infinite loops
  const hasLoadedRef = useRef(false);
  const lastWorkoutIdRef = useRef(null);
  
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    if (!isMember(currentUser)) {
      navigate('/login');
      return;
    }
    
    // Only load if workout ID changed or we haven't loaded yet
    const workoutIdChanged = lastWorkoutIdRef.current !== id;
    const hasWorkoutData = cachedWorkout || workout;
    const shouldLoad = workoutIdChanged || (!hasLoadedRef.current && hasWorkoutData);
    
    if (shouldLoad && hasWorkoutData) {
      hasLoadedRef.current = true;
      lastWorkoutIdRef.current = id;
      loadWorkoutDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, navigate, isMember, id, cachedWorkout, loadWorkoutDetails]); // Removed 'workout' from deps to prevent infinite loop

  // Listen for profile updates to refresh profile pictures
  useEffect(() => {
    const handleProfileUpdate = () => {
      refreshWorkout();
      loadWorkoutDetails();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [refreshWorkout, loadWorkoutDetails]);

  // eslint-disable-next-line no-unused-vars
  const loadWorkoutDetails_legacy = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      // Load workout details
      const workoutResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (workoutResponse.ok) {
        const workoutData = await workoutResponse.json();
        setWorkout(workoutData.workout);
        setSignups(workoutData.signups || []);
        setWaitlist(workoutData.waitlist || []);
        
        // Check if this is a swim workout and user is exec/admin
        const isSwim = workoutData.workout?.workout_type === 'swim';
        const isExec = currentUser?.role === 'exec' || currentUser?.role === 'administrator' || currentUser?.role === 'coach';
        setIsSwimWorkout(isSwim);
        
        // Load swim members if this is a swim workout and user is exec/admin
        if (isSwim && isExec) {
          const swimMembersResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}/attendance-members`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (swimMembersResponse.ok) {
            const swimMembersData = await swimMembersResponse.json();
            setSwimMembers(swimMembersData.members || []);
          } else {
            console.error('❌ Failed to load swim members:', swimMembersResponse.status);
          }
        }
      } else {
        console.error('❌ Failed to load workout details:', workoutResponse.status, workoutResponse.statusText);
        const errorData = await workoutResponse.json().catch(() => ({}));
        console.error('❌ Error details:', errorData);
      }

      // Check if attendance has already been submitted
      const attendanceResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}/attendance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (attendanceResponse.ok) {
        const attendanceData = await attendanceResponse.json();
        setAttendanceSaved(attendanceData.attendance && attendanceData.attendance.length > 0);
        
        // Process attendance and late status
        if (attendanceData.attendance && attendanceData.attendance.length > 0) {
          const attendanceMap = {};
          const lateMap = {};
          attendanceData.attendance.forEach(record => {
            attendanceMap[record.user_id] = record.attended;
            lateMap[record.user_id] = record.late || false;
          });
          setAttendance(attendanceMap);
          setLateStatus(lateMap);
        }
      } else {
        setAttendanceSaved(false);
      }

      // Load signups
      const signupsResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}/signups`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (signupsResponse.ok) {
        const signupsData = await signupsResponse.json();
        setSignups(signupsData.signups);
        
        // Check if current user is signed up
        const userSignup = signupsData.signups.find(s => s.user_id === currentUser.id);
        setIsSignedUp(!!userSignup);
      }

      // Load waitlist
      const waitlistResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}/waitlist`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (waitlistResponse.ok) {
        const waitlistData = await waitlistResponse.json();
        setWaitlist(waitlistData.waitlist);
        
        // Check if current user is on waitlist
        const userWaitlist = waitlistData.waitlist.find(w => w.user_id === currentUser.id);
        setIsOnWaitlist(!!userWaitlist);
      }

      // Load comments
      try {
        const commentsResponse = await fetch(`${API_BASE_URL}/forum/posts/${id}/comments`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (commentsResponse.ok) {
          const commentsData = await commentsResponse.json();
          setComments(commentsData.comments || []);
        } else {
          setComments([]);
        }
      } catch (error) {
        console.error('Error loading comments:', error);
        setComments([]);
      }


      setLoading(false);
    } catch (error) {
      console.error('Error loading workout details:', error);
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
      // Check if offline - workout signups require online connection
      if (!navigator.onLine) {
        showError("Whoops! You're offline right now. Please check your internet connection and try again when you're back online!");
        return;
      }

    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/forum/workouts/${id}/signup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.signedUp) {
          // User just signed up
          setIsSignedUp(true);
          // Reload signups to get the updated list
          const signupsResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}/signups`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (signupsResponse.ok) {
            const signupsData = await signupsResponse.json();
            setSignups(signupsData.signups);
          }
        } else {
          // User just removed signup
          setIsSignedUp(false);
          // Reload signups to get the updated list
          const signupsResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}/signups`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (signupsResponse.ok) {
            const signupsData = await signupsResponse.json();
            setSignups(signupsData.signups);
          }
        }
      } else {
        const error = await response.json();
        showError(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating signup:', error);
      showError('Error updating signup');
    }
  };

  const handleWaitlistJoin = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/forum/workouts/${id}/waitlist`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setIsOnWaitlist(true);
        // Reload waitlist
        const waitlistResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}/waitlist`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (waitlistResponse.ok) {
          const waitlistData = await waitlistResponse.json();
          setWaitlist(waitlistData.waitlist);
        }
      } else {
        const error = await response.json();
        showError(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error joining waitlist:', error);
      showError('Error joining waitlist');
    }
  };

  const handleWaitlistLeave = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/forum/workouts/${id}/waitlist`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setIsOnWaitlist(false);
        // Reload waitlist
        const waitlistResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}/waitlist`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (waitlistResponse.ok) {
          const waitlistData = await waitlistResponse.json();
          setWaitlist(waitlistData.waitlist);
        }
      } else {
        const error = await response.json();
        showError(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error leaving waitlist:', error);
      showError('Error leaving waitlist');
    }
  };

  const handleCancelClick = () => {
    setShowCancelModal(true);
  };



  const [deleteWorkoutConfirm, setDeleteWorkoutConfirm] = useState({ isOpen: false });

  const handleDeleteWorkout = async () => {
    setDeleteWorkoutConfirm({ isOpen: true });
  };

  const confirmDeleteWorkout = async () => {
    setDeleteWorkoutConfirm({ isOpen: false });

    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/forum/posts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        navigate('/forum');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete workout');
      }
    } catch (error) {
      console.error('Error deleting workout:', error);
      showError(`Error deleting workout: ${error.message}`);
    }
  };

  const handleCancelSignup = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      // Check if offline - workout cancellations require online connection
      if (!navigator.onLine) {
        showError("Whoops! You're offline right now. Please check your internet connection and try again when you're back online!");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/forum/workouts/${id}/signup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsSignedUp(false);
        
        // Show appropriate message based on 12-hour rule
        if (data.within12hrs && data.markedAbsent) {
          showWarning(data.message + ' This cancellation has been recorded as an absence.');
        } else {
          showSuccess(data.message);
        }
        
        // Reload signups
        const signupsResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}/signups`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (signupsResponse.ok) {
          const signupsData = await signupsResponse.json();
          setSignups(signupsData.signups);
        }

        // Reload waitlist to check for promotions
        const waitlistResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}/waitlist`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (waitlistResponse.ok) {
          const waitlistData = await waitlistResponse.json();
          setWaitlist(waitlistData.waitlist);
        }

        setShowCancelModal(false);
      } else {
        const error = await response.json();
        showError(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error canceling signup:', error);
      showError('Error canceling signup');
    }
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
  };

  const handleAddToCalendar = async () => {

    if (!displayWorkout) {
      showError('Workout information not available');
      return;
    }

    if (!displayWorkout.workout_date || !displayWorkout.workout_time) {
      showError('Workout date or time is missing');
      return;
    }

    const isIOS = Capacitor.getPlatform() === 'ios';
    if (!isIOS) {
      showError('Calendar feature is only available on iOS');
      return;
    }

    if (checkingCalendar) {
      return; // Prevent multiple clicks
    }

    setCheckingCalendar(true);

    try {
      const result = await addWorkoutToCalendar({
        id: displayWorkout.id,
        title: displayWorkout.title,
        workout_type: displayWorkout.workout_type,
        workout_date: displayWorkout.workout_date,
        workout_time: displayWorkout.workout_time,
        description: displayWorkout.content,
        capacity: displayWorkout.capacity
      });
      
      if (result.success) {
        setIsInCalendar(true);
        // Store in localStorage to persist across page reloads
        const calendarEvents = JSON.parse(localStorage.getItem('calendarEvents') || '[]');
        if (!calendarEvents.includes(displayWorkout.id)) {
          calendarEvents.push(displayWorkout.id);
          localStorage.setItem('calendarEvents', JSON.stringify(calendarEvents));
        }
        showSuccess('Workout added to calendar!');
      }
    } catch (error) {
      console.error('Error adding workout to calendar:', error);
      // Show user-friendly error message
      const errorMessage = error.message || 'Failed to add workout to calendar';
      if (errorMessage.includes('not registered') || errorMessage.includes('plugin')) {
        showError('Calendar feature is not set up. Please contact support or check IOS_CALENDAR_PLUGIN_SETUP.md for setup instructions.');
      } else {
        showError(errorMessage);
      }
    } finally {
      setCheckingCalendar(false);
    }
  };

  // Check if workout is in calendar on load (only check localStorage, don't request permissions)
  useEffect(() => {
    const checkCalendarStatus = () => {
      try {
        // Use workout || cachedWorkout directly since displayWorkout is defined later
        const currentWorkout = workout || cachedWorkout;
        if (!currentWorkout || !currentWorkout.workout_date || !currentWorkout.workout_time) {
          return;
        }

        const isIOS = Capacitor.getPlatform() === 'ios';
        if (!isIOS) {
          return;
        }

        // Only check localStorage - don't check actual calendar to avoid permission prompt
        // The actual calendar check will happen when user clicks "Add to Calendar"
        try {
          const calendarEvents = JSON.parse(localStorage.getItem('calendarEvents') || '[]');
          if (calendarEvents.includes(currentWorkout.id)) {
            setIsInCalendar(true);
          }
        } catch (e) {
          // localStorage error - ignore
        }
      } catch (error) {
        // Catch any unexpected errors to prevent component crash
        console.error('Error in checkCalendarStatus:', error);
      }
    };

    checkCalendarStatus();
  }, [workout, cachedWorkout]);
  /* eslint-enable no-use-before-define */

  const handleAttendanceChange = (userId, isPresent) => {
    if (!userId) {
      console.error('❌ Invalid user ID:', userId);
      return;
    }
    setAttendance(prev => ({
      ...prev,
      [userId]: isPresent
    }));
  };

  const handleLateChange = (userId, isLate) => {
    if (!userId) {
      console.error('❌ Invalid user ID:', userId);
      return;
    }
    setLateStatus(prev => ({
      ...prev,
      [userId]: isLate
    }));
  };

  const handleSubmitAttendance = async () => {
    const token = localStorage.getItem('triathlonToken');
    if (!token) {
      console.error('No authentication token found');
      return;
    }

    try {
      setSubmittingAttendance(true);
      // Optimistically mark as submitted so the UI reflects it immediately
      setAttendanceSaved(true);

      const response = await fetch(`${API_BASE_URL}/forum/workouts/${id}/attendance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          attendanceData: attendance,
          lateData: lateStatus,
          isSwimWorkout: isSwimWorkout
        })
      });

      if (response.ok) {
        await response.json();
        setEditingAttendance(false);
      } else {
        const errorData = await response.json();
        console.error('Failed to save attendance:', errorData.error);
        // Revert optimistic update on failure
        setAttendanceSaved(false);
        showError(`Failed to save attendance: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error submitting attendance:', error);
      // Revert optimistic update on failure
      setAttendanceSaved(false);
      showError('Error submitting attendance. Please try again.');
    } finally {
      setSubmittingAttendance(false);
    }
  };

  const handleEditAttendance = () => {
    setEditingAttendance(true);
  };

  const handleCancelEditAttendance = () => {
    setEditingAttendance(false);
    // Reload attendance data to reset any unsaved changes
    loadWorkoutDetails();
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/forum/posts/${id}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newComment.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Add the new comment to the list
        setComments([...comments, data.comment]);
        setNewComment('');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to post comment' }));
        console.error('Error posting comment:', errorData);
        showError(errorData.error || 'Failed to post comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      showError('Failed to post comment. Please try again.');
    }
  };

  // Interval Results
  const handleSubmitIntervalResults = async () => {
    const results = workoutIntervals
      .map((inv) => ({ interval_id: inv.id, time: intervalResultForm[inv.id] || '' }))
      .filter((r) => r.time && String(r.time).trim());
    if (results.length === 0) {
      showError('Please enter at least one interval time');
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/forum/workouts/${id}/interval-results`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ results })
      });

      if (response.ok) {
        showSuccess('Interval results saved!');
        setShowIntervalResultModal(false);
        setIntervalResultForm({});
        loadWorkoutDetails();
      } else {
        const err = await response.json();
        showError(err.error || 'Failed to save results');
      }
    } catch (error) {
      console.error('Error saving interval results:', error);
      showError('Error saving interval results');
    }
  };

  const openIntervalResultModal = () => {
    const existing = {};
    intervalResults
      .filter((r) => r.user_id === currentUser?.id)
      .forEach((r) => { existing[r.interval_id] = r.time; });
    setIntervalResultForm(existing);
    setShowIntervalResultModal(true);
  };

  const handleDeleteIntervalResult = async () => {
    const intervalId = deleteIntervalConfirm.intervalId;
    if (!intervalId) return;
    setDeletingIntervalId(intervalId);
    try {
      const token = localStorage.getItem('triathlonToken');
      const res = await fetch(
        `${API_BASE_URL}/forum/workouts/${id}/interval-results/${intervalId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        showSuccess('Interval result deleted');
        setIntervalResultForm((prev) => {
          const next = { ...prev };
          delete next[intervalId];
          return next;
        });
        setIntervalResults((prev) => prev.filter((r) => !(r.interval_id === intervalId && r.user_id === currentUser?.id)));
        setDeleteIntervalConfirm({ isOpen: false, intervalId: null });
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to delete');
      }
    } catch (err) {
      showError('Failed to delete interval result');
    } finally {
      setDeletingIntervalId(null);
    }
  };

  const handleAddInterval = async () => {
    if (!addIntervalForm.title || !addIntervalForm.title.trim()) {
      showError('Interval title is required');
      return;
    }
    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/forum/workouts/${id}/intervals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: addIntervalForm.title.trim(),
          description: addIntervalForm.description?.trim() || null
        })
      });
      if (response.ok) {
        const data = await response.json();
        setWorkoutIntervals((prev) => [...prev, data.interval].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
        setShowAddIntervalModal(false);
        setAddIntervalForm({ title: '', description: '' });
        showSuccess('Interval added!');
        loadWorkoutDetails();
      } else {
        const err = await response.json();
        showError(err.error || 'Failed to add interval');
      }
    } catch (error) {
      console.error('Error adding interval:', error);
      showError('Error adding interval');
    }
  };

  if (loading || workoutLoading) {
    return (
      <div className="workout-detail-container">
        <div className="container">
          <div className="loading" style={{ padding: '2rem', textAlign: 'center' }}>
            Loading workout details...
          </div>
        </div>
      </div>
    );
  }

  // Show error if there's an error and no cached data
  if (error && !cachedWorkout) {
    const isOffline = !navigator.onLine;
    return (
      <div className="workout-detail-container">
        <div className="container">
          <button className="back-btn" onClick={() => navigate('/forum')}>
            ← Back to Forum
          </button>
          <div className="error" style={{ 
            padding: '2rem', 
            textAlign: 'center',
            backgroundColor: isOffline ? '#fef3c7' : '#fee',
            border: `1px solid ${isOffline ? '#fbbf24' : '#fcc'}`,
            borderRadius: '4px',
            margin: '2rem 0'
          }}>
            <h2>{isOffline ? '📴 You Are Offline' : 'Error Loading Workout'}</h2>
            <p>{isOffline ? 'This workout cannot be loaded while you are offline. Please check your internet connection and try again.' : error}</p>
            {!isOffline && (
              <button 
                onClick={() => {
                  setError(null);
                  loadWorkoutDetails();
                }}
                style={{
                  marginTop: '1rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!workout && !cachedWorkout && !error) {
    const isOffline = !navigator.onLine;
    return (
      <div className="workout-detail-container">
        <div className="container">
          <button className="back-btn" onClick={() => navigate('/forum')}>
            ← Back to Forum
          </button>
          <div className="error" style={{ 
            padding: '2rem', 
            textAlign: 'center',
            backgroundColor: isOffline ? '#fef3c7' : '#fee',
            border: `1px solid ${isOffline ? '#fbbf24' : '#fcc'}`,
            borderRadius: '4px',
            margin: '2rem 0'
          }}>
            <h2>{isOffline ? '📴 You Are Offline' : 'Workout Not Found'}</h2>
            <p>{isOffline 
              ? 'This workout cannot be loaded while you are offline. Please check your internet connection and try again.'
              : 'The workout you\'re looking for doesn\'t exist or has been deleted.'}
            </p>
            <button 
              onClick={() => navigate('/forum')}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Go to Forum
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Use cached workout if state workout is not available
  const displayWorkout = workout || cachedWorkout;
  const displaySignups = signups.length > 0 ? signups : (cachedSignups || []);
  const displayWaitlist = waitlist.length > 0 ? waitlist : (cachedWaitlist || []);

  // Safety check - don't render if no workout data
  if (!displayWorkout) {
    return null;
  }

  return (
    <div
      className="workout-detail-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="container">
        <button className="back-btn" onClick={() => navigate('/forum')}>
          ← Back to Forum
        </button>
        
        {/* Offline Indicator */}
        {!isOnline && (
          <div className="offline-indicator">
            <span className="offline-icon">📴</span>
            <span className="offline-text">You're offline. Showing cached data.</span>
          </div>
        )}

        <div className="workout-detail-card">
          <div className="workout-header">
            <div className="workout-title-section">
              <h1 className="workout-title">
                {displayWorkout.title}
                {!isOnline && (
                  <span className="offline-badge" style={{ marginLeft: '0.75rem' }} title="You're offline">
                    📴 Offline
                  </span>
                )}
                {workoutFromCache && isOnline && (
                  <span className="cache-indicator" style={{ marginLeft: '0.75rem' }} title="Showing cached data">
                    📦 Cached
                  </span>
                )}
              </h1>
            </div>
            <div className="workout-author">
              <div className="author-info">
                {(() => {
                  const url = normalizeProfileImageUrl(displayWorkout.authorProfilePictureUrl);
                  return url ? (
                    <img 
                      src={url}
                      alt="Profile" 
                      className="author-avatar"
                      loading="lazy"
                      decoding="async"
                      fetchpriority="low"
                      onError={(e) => {
                        e.target.src = '/images/default_profile.png';
                      }}
                    />
                  ) : (
                    <img 
                      src="/images/default_profile.png" 
                      alt="Profile" 
                      className="author-avatar"
                    />
                  );
                })()}
                <span className="author-name">Posted by {displayWorkout.author_name}</span>
              </div>
            </div>
          </div>

          {displayWorkout.workout_type && (
            <div className="workout-meta">
              <span className="workout-type-badge">{displayWorkout.workout_type}</span>
              {displayWorkout.workout_date && (
                <span className="workout-date">
                  📅 {(() => { const b = displayWorkout.workout_date.split('T')[0]; const [y,m,d] = b.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)).toLocaleDateString(undefined,{ timeZone: 'UTC' }); })()}
                  {displayWorkout.workout_time && (
                    <span className="workout-time"> • 🕐 {displayWorkout.workout_time}</span>
                  )}
                </span>
              )}
            </div>
          )}

          {/* Edit/Delete actions for workout author or exec/admin - bottom left of first card */}
          {(() => {
            const canEdit =
              currentUser.id === displayWorkout.user_id ||
              currentUser.role === 'exec' ||
              currentUser.role === 'administrator';
            return canEdit;
          })() && !editMode && (
            <div className="workout-actions-admin-bottom-left">
              <button
                className="edit-btn"
                onClick={() => {
                  if (displayWorkout) {
                    startEdit(displayWorkout);
                    setEditMode(true);
                  } else {
                    console.error('❌ Workout is null or undefined');
                  }
                }}
                disabled={editMode}
              >
                ✏️<span className="btn-text"> Edit</span>
              </button>
              <button
                className="delete-btn"
                onClick={handleDeleteWorkout}
                disabled={editMode}
              >
                🗑️<span className="btn-text"> Delete</span>
              </button>
            </div>
          )}

          {editMode ? (
            <div className="workout-edit-form">
              <div className="form-group">
                <label htmlFor="workout-title-input">Title:</label>
                <input
                  id="workout-title-input"
                  type="text"
                                              value={editForm.title}
                            onChange={(e) => updateField('title', e.target.value)}
                  className="form-input"
                  placeholder="Enter workout title..."
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="workout-type-input">Workout Type:</label>
                  <input
                    id="workout-type-input"
                    type="text"
                                                value={editForm.workoutType}
                            onChange={(e) => updateField('workoutType', e.target.value)}
                    className="form-input"
                    placeholder="Enter workout type..."
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="workout-capacity-input">Capacity:</label>
                  <input
                    id="workout-capacity-input"
                    type="number"
                    min="1"
                                                value={editForm.capacity}
                            onChange={(e) => updateField('capacity', e.target.value)}
                    className="form-input"
                    placeholder="Enter workout capacity..."
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="workout-date-input">Date:</label>
                  <input
                    id="workout-date-input"
                    type="date"
                                                value={editForm.workoutDate}
                            onChange={(e) => updateField('workoutDate', e.target.value)}
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="workout-time-input">Time:</label>
                  <input
                    id="workout-time-input"
                    type="time"
                                                value={editForm.workoutTime}
                            onChange={(e) => updateField('workoutTime', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
              

              
              <div className="form-group">
                <label htmlFor="workout-content-input">Description:</label>
                <textarea
                  id="workout-content-input"
                                              value={editForm.content}
                            onChange={(e) => updateField('content', e.target.value)}
                  className="form-textarea"
                  rows="5"
                  placeholder="Enter workout description..."
                />
              </div>
              
              <div className="edit-actions">
                <button 
                  className="btn btn-primary" 
                                      onClick={async () => {
                      const result = await saveWorkout(displayWorkout.id, loadWorkoutDetails);
                      if (result.success) {
                        setEditMode(false);
                        showSuccess('Workout updated successfully!');
                      } else {
                        showError(`Error updating workout: ${result.error}`);
                      }
                    }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button 
                  className="btn btn-secondary" 
                                      onClick={() => {
                      cancelEdit();
                      setEditMode(false);
                    }}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="workout-content">
              {linkifyText(displayWorkout.content)}
            </div>
          )}

          {/* Only show signup/waitlist buttons for non-swim workouts */}
          {!isSwimWorkout && !isWorkoutStarted() && (
            <div className="workout-actions">
              <div className="button-group">
                <button 
                  onClick={handleSignUp}
                  className={`signup-btn ${isSignedUp ? 'signed-up' : ''}`}
                  disabled={displayWorkout.capacity && displaySignups.length >= displayWorkout.capacity && !isSignedUp}
                >
                  {isSignedUp ? '✓ Signed Up' : (displayWorkout.capacity && displaySignups.length >= displayWorkout.capacity) ? 'Full' : 'Sign Up'}
                </button>
                
                {/* Cancel button for signed-up users */}
                {isSignedUp && (
                  <button 
                    onClick={handleCancelClick}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                )}
                
                {/* Waitlist button for full workouts */}
                {displayWorkout.capacity && displaySignups.length >= displayWorkout.capacity && !isSignedUp && (
                  <button 
                    onClick={isOnWaitlist ? handleWaitlistLeave : handleWaitlistJoin}
                    className={`waitlist-btn ${isOnWaitlist ? 'on-waitlist' : ''}`}
                  >
                    {isOnWaitlist ? 'Leave Waitlist' : 'Join Waitlist'}
                  </button>
                )}

                {/* Position label when on waitlist */}
                {displayWorkout.capacity && displaySignups.length >= displayWorkout.capacity && isOnWaitlist && (
                  <span className="waitlist-position">
                    {`You're ${formatOrdinal(getWaitlistPosition())} on the waitlist`}
                  </span>
                )}
              </div>
              
            </div>
          )}
          
          {/* Add to Calendar button - iOS only, show if workout has date and time */}
          {Capacitor.getPlatform() === 'ios' && displayWorkout && displayWorkout.workout_date && displayWorkout.workout_time && (
            <div className="workout-actions">
              <div className="calendar-button-container">
                <button 
                  onClick={handleAddToCalendar}
                  className={`calendar-btn ${isInCalendar ? 'added-to-calendar' : ''}`}
                  disabled={checkingCalendar || isInCalendar}
                >
                  {checkingCalendar ? 'Adding...' : isInCalendar ? '✓ Added to Calendar' : '📅 Add to Calendar'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Only show signups section for non-swim workouts OR swim workouts when user is coach/exec/admin */}
        {(!isSwimWorkout || (isSwimWorkout && currentUser && (currentUser.role === 'coach' || currentUser.role === 'exec' || currentUser.role === 'administrator'))) && (
          <div className="signups-section">
            <h2>
              {isSwimWorkout && currentUser && (currentUser.role === 'coach' || currentUser.role === 'exec' || currentUser.role === 'administrator') 
                ? `Swim Attendance (${swimMembers.length})` 
                : `Who's Coming (${displaySignups.length}${displayWorkout.capacity ? `/${displayWorkout.capacity}` : ''})`
              }
            </h2>
            
            {/* Show swim members for swim workouts when user is coach/exec/admin */}
            {isSwimWorkout && currentUser && (currentUser.role === 'coach' || currentUser.role === 'exec' || currentUser.role === 'administrator') ? (
            swimMembers.length === 0 ? (
              <p className="no-signups">Loading members...</p>
            ) : (
              <>
                <div className="signups-list">
                  {swimMembers.map(member => (
                    <div key={member.user_id} className="signup-item">
                      {/* Attendance and Late checkboxes for executives and administrators */}
                      <div className="attendance-controls">
                        <div className="attendance-checkbox">
                          <input
                            type="checkbox"
                            id={`attendance-${member.user_id}`}
                            checked={attendance[member.user_id] || false}
                            onChange={(e) => {
                              handleAttendanceChange(member.user_id, e.target.checked);
                              // Clear late status if attendance is unchecked
                              if (!e.target.checked) {
                                handleLateChange(member.user_id, false);
                              }
                            }}
                            disabled={attendanceSaved && !editingAttendance}
                            title={attendanceSaved && !editingAttendance ? "Click 'Edit Attendance' to modify" : "Mark as present"}
                          />
                          <label htmlFor={`attendance-${member.user_id}`} className="sr-only">
                            Mark {member.user_name} as present
                          </label>
                        </div>
                        
                        {/* Late checkbox only shows when attendance is checked */}
                        {attendance[member.user_id] && (
                          <div className="late-checkbox">
                            <label htmlFor={`late-${member.user_id}`} className="late-label">Late?</label>
                            <input
                              type="checkbox"
                              id={`late-${member.user_id}`}
                              checked={lateStatus[member.user_id] || false}
                              onChange={(e) => {
                                handleLateChange(member.user_id, e.target.checked);
                              }}
                              disabled={attendanceSaved && !editingAttendance}
                              title={attendanceSaved && !editingAttendance ? "Click 'Edit Attendance' to modify" : "Mark as late"}
                            />
                          </div>
                        )}
                      </div>
                      
                      <div className="signup-user-info">
                        <div className="user-avatar-placeholder">
                          <img 
                            src="/images/default_profile.png" 
                            alt="Profile" 
                            style={{ width: '16px', height: '16px', filter: 'brightness(0) invert(1)' }}
                          />
                        </div>
                        <span className="signup-user">
                          {member.user_name}
                          {member.is_signed_up && <span className="signed-up-badge">✓ Signed up</span>}
                        </span>
                      </div>
                      <span className="signup-date">
                        {member.is_signed_up && '📅 Signed up'}
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Submit attendance button for executives and administrators */}
                {swimMembers.length > 0 && (
                  <div className="attendance-submit">
                    <div className="attendance-debug">
                      <small>📊 {swimMembers.length} members • {Object.keys(attendance).length} attendance records</small>
                    </div>
                    {attendanceSaved && !editingAttendance ? (
                      <div className="attendance-actions">
                        <button 
                          onClick={handleEditAttendance}
                          className="edit-attendance-btn"
                          title="Edit attendance"
                        >
                          ✏️ Edit Attendance
                        </button>
                        <div className="attendance-status">
                          ✅ Swim Attendance Submitted
                        </div>
                      </div>
                    ) : (
                      <div className="attendance-actions">
                        <button 
                          onClick={handleSubmitAttendance}
                          className={`submit-attendance-btn ${attendanceSaved ? 'saved' : ''}`}
                          title="Submit attendance and update absences"
                          disabled={submittingAttendance}
                        >
                          {submittingAttendance ? 'Submitting...' : '📝 Submit Swim Attendance'}
                        </button>
                        {editingAttendance && (
                          <button 
                            onClick={handleCancelEditAttendance}
                            className="cancel-edit-btn"
                            title="Cancel editing"
                          >
                            ❌ Cancel
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )
          ) : (
            /* Regular signups display for non-swim workouts */
            displaySignups.length === 0 ? (
              <p className="no-signups">No one has signed up yet. Be the first!</p>
            ) : (
              <>
                <div className="signups-list">
                  {displaySignups.map(signup => (
                    <div key={signup.id} className="signup-item">
                      {/* Attendance checkbox for coaches, executives, and administrators */}
                      {currentUser && (currentUser.role === 'coach' || currentUser.role === 'exec' || currentUser.role === 'administrator') && (
                        <div className="attendance-checkbox">
                          <input
                            type="checkbox"
                            id={`attendance-${signup.user_id}`}
                            checked={attendance[signup.user_id] || false}
                            onChange={(e) => {
                              handleAttendanceChange(signup.user_id, e.target.checked);
                            }}
                            disabled={attendanceSaved && !editingAttendance}
                            title={attendanceSaved && !editingAttendance ? "Click 'Edit Attendance' to modify" : "Mark as present"}
                          />
                          <label htmlFor={`attendance-${signup.user_id}`} className="sr-only">
                            Mark {signup.user_name} as present
                          </label>
                        </div>
                      )}
                      
                      <div className="signup-user-info">
                        {(() => {
                          const { normalizeProfileImageUrl } = require('../utils/imageUtils');
                          const url = normalizeProfileImageUrl(signup.userProfilePictureUrl);
                          return url ? (
                            <img 
                              src={url}
                              alt="Profile" 
                              className="user-avatar"
                              onError={(e) => {
                                e.target.src = '/images/icon.png';
                              }}
                            />
                          ) : (
                            <div className="user-avatar-placeholder">
                              <img 
                                src="/images/default_profile.png" 
                                alt="Profile" 
                                style={{ width: '16px', height: '16px', filter: 'brightness(0) invert(1)' }}
                              />
                            </div>
                          );
                        })()}
                        {/* single avatar element handled above */}
                        <span className="signup-user">{signup.user_name}</span>
                      </div>
                      <span className="signup-date">
                        📅 {signup.signup_time && signup.signup_time !== 'Invalid Date' && signup.signup_time !== 'null' 
                          ? formatSignupDateForDisplay(signup.signup_time)
                          : 'Recently'
                        }
                        <span className="signup-time"> • 🕐 {signup.signup_time && signup.signup_time !== 'Invalid Date' && signup.signup_time !== 'null' 
                          ? formatSignupTimeOnlyForDisplay(signup.signup_time)
                          : 'Recently'
                        }</span>
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Submit attendance button for coaches, executives and administrators */}
                {currentUser && (currentUser.role === 'coach' || currentUser.role === 'exec' || currentUser.role === 'administrator') && displaySignups.length > 0 && (
                  <div className="attendance-submit">
                    <div className="attendance-debug">
                      <small>📊 {displaySignups.length} signups • {Object.keys(attendance).length} attendance records</small>
                    </div>
                    {attendanceSaved && !editingAttendance ? (
                      <div className="attendance-actions">
                        <button 
                          onClick={handleEditAttendance}
                          className="edit-attendance-btn"
                          title="Edit attendance"
                        >
                          ✏️ Edit Attendance
                        </button>
                        <div className="attendance-status">
                          ✅ Attendance Submitted
                        </div>
                      </div>
                    ) : (
                      <div className="attendance-actions">
                        <button 
                          onClick={handleSubmitAttendance}
                          className={`submit-attendance-btn ${attendanceSaved ? 'saved' : ''}`}
                          title="Submit attendance and update absences"
                          disabled={submittingAttendance}
                        >
                          {submittingAttendance ? 'Submitting...' : '📝 Submit Attendance'}
                        </button>
                        {editingAttendance && (
                          <button 
                            onClick={handleCancelEditAttendance}
                            className="cancel-edit-btn"
                            title="Cancel editing"
                          >
                            ❌ Cancel
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )
          )}
          </div>
        )}

        {/* Waitlist section - only show for non-swim workouts */}
        {!isSwimWorkout && displayWorkout.capacity && displayWaitlist.length > 0 && (
          <div className="waitlist-section">
            <h2>Waitlist ({displayWaitlist.length})</h2>
            <div className="waitlist-list">
              {displayWaitlist.map(waitlistItem => (
                <div key={waitlistItem.id} className="waitlist-item">
                  <div className="waitlist-user-info">
                    {waitlistItem.userProfilePictureUrl ? (
                      <img 
                        src={`${API_BASE_URL}${waitlistItem.userProfilePictureUrl}`} 
                        alt="Profile" 
                        className="user-avatar"
                        onError={(e) => {
                          e.target.src = '/images/icon.png';
                        }}
                      />
                    ) : (
                      <div className="user-avatar-placeholder">
                        <img 
                          src="/images/default_profile.png" 
                          alt="Profile" 
                          style={{ width: '16px', height: '16px', filter: 'brightness(0) invert(1)' }}
                        />
                      </div>
                    )}
                    <span className="waitlist-user">{waitlistItem.user_name}</span>
                  </div>
                  <span className="waitlist-date">
                    📅 {new Date(waitlistItem.joined_at).toLocaleDateString()}
                    <span className="waitlist-time"> • 🕐 {new Date(waitlistItem.joined_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interval Results Section - available on web and iOS for all members */}
        {((workoutIntervals.length > 0 || isCoachOrAdmin) && currentUser) && (
        <div className="test-event-section" style={{ marginTop: '2rem', background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, color: '#374151' }}>Interval Results</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {isCoachOrAdmin && (
                <button
                  className="btn btn-secondary"
                  onClick={() => { setAddIntervalForm({ title: '', description: '' }); setShowAddIntervalModal(true); }}
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  + Add Interval
                </button>
              )}
              {currentUser && workoutIntervals.length > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={openIntervalResultModal}
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  + Add Interval Results
                </button>
              )}
            </div>
          </div>

          {workoutIntervals.length === 0 ? (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
              {isCoachOrAdmin
                ? 'No intervals defined yet. Click "Add Interval" to add intervals for this workout.'
                : 'No intervals defined for this workout. Coaches can add intervals when creating a workout post.'}
            </p>
          ) : (
            <>
              <div
                role="button"
                tabIndex={0}
                onClick={() => currentUser && openIntervalResultModal()}
                onKeyDown={(e) => currentUser && (e.key === 'Enter' || e.key === ' ') && openIntervalResultModal()}
                style={{
                  marginBottom: '1rem',
                  padding: '1rem',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  cursor: currentUser ? 'pointer' : 'default',
                }}
              >
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>Intervals</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  {workoutIntervals.map((inv, idx) => (
                    <div key={inv.id}>
                      <strong>{inv.title || `Interval ${idx + 1}`}</strong>
                      {inv.description ? `: ${inv.description}` : ''}
                    </div>
                  ))}
                </div>
                {currentUser && (
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                    Tap or click to edit your interval results
                  </p>
                )}
              </div>

              {intervalResults.length > 0 ? (
                  (() => {
                    const byUser = {};
                    intervalResults.forEach((r) => {
                      if (!byUser[r.user_id]) byUser[r.user_id] = { user_name: r.user_name, times: {} };
                      byUser[r.user_id].times[r.interval_id] = r.time;
                    });
                    const users = Object.entries(byUser);
                    return (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={openIntervalResultModal}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openIntervalResultModal()}
                        style={{ overflowX: 'auto', cursor: 'pointer' }}
                      >
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Name</th>
                              {workoutIntervals.map((inv) => (
                                <th key={inv.id} style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>
                                  {inv.title || inv.interval_title || 'Interval'}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {users.map(([uid, data]) => (
                              <tr key={uid} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '0.75rem', color: '#475569' }}>{data.user_name}</td>
                                {workoutIntervals.map((inv) => (
                                  <td key={inv.id} style={{ padding: '0.75rem', color: '#475569' }}>
                                    {data.times[inv.id] || '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                          Tap to edit your interval results
                        </p>
                      </div>
                    );
                  })()
                ) : (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
                    No interval results yet. Click &quot;Add Interval Results&quot; to add yours.
                  </p>
                )}
            </>
          )}
        </div>
        )}

        <div className="comments-section">
          <h2>Comments ({comments.length})</h2>
          
          <form onSubmit={handleCommentSubmit} className="comment-form">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows="3"
              maxLength="500"
              required
            />
            <button type="submit" className="comment-submit-btn">Post Comment</button>
          </form>

          {comments.length === 0 ? (
            <p className="no-comments">No comments yet. Start the conversation!</p>
          ) : (
            <div className="comments-list">
              {comments.map(comment => (
                <div key={comment.id} className="comment-item">
                  <div className="comment-header">
                    <div className="comment-author-info">
                                          {comment.userProfilePictureUrl ? (
                      <img 
                        src={`${API_BASE_URL}${comment.userProfilePictureUrl}`} 
                        alt="Profile" 
                        className="user-avatar"
                        onError={(e) => {
                          e.target.src = '/images/default_profile.png';
                        }}
                      />
                    ) : (
                      <img 
                        src="/images/default_profile.png" 
                        alt="Profile" 
                        className="user-avatar"
                      />
                    )}
                      <span className="comment-author">{comment.user_name}</span>
                    </div>
                    <span className="comment-date">
                      {(() => {
                        try {
                          const date = new Date(comment.created_at);
                          if (isNaN(date.getTime())) {
                            return `📅 ${comment.created_at}`;
                          }
                          return (
                            <>
                              📅 {date.toLocaleDateString()}
                              <span className="comment-time"> • 🕐 {date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </>
                          );
                        } catch (error) {
                          return `📅 ${comment.created_at}`;
                        }
                      })()}
                    </span>
                  </div>
                  <div className="comment-content">{linkifyText(comment.content)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Interval Modal - coaches/admins */}
        {showAddIntervalModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h2>Add Interval</h2>
              <form onSubmit={(e) => { e.preventDefault(); handleAddInterval(); }}>
                <div className="form-group">
                  <label>Interval title</label>
                  <input
                    type="text"
                    value={addIntervalForm.title}
                    onChange={(e) => setAddIntervalForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g., 200m, 1km, Lap 1"
                    maxLength="80"
                    required
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                </div>
                <div className="form-group">
                  <label>Description (optional)</label>
                  <input
                    type="text"
                    value={addIntervalForm.description}
                    onChange={(e) => setAddIntervalForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="e.g., 2:15 target time"
                    maxLength="120"
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowAddIntervalModal(false); setAddIntervalForm({ title: '', description: '' }); }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">Add Interval</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Interval Results Modal */}
        {showIntervalResultModal && workoutIntervals.length > 0 && (
          <div className="modal-overlay" onClick={() => { setShowIntervalResultModal(false); setIntervalResultForm({}); }}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Edit Interval Results</h2>
              <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Workout</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#374151' }}>{displayWorkout?.title || 'Workout'}</div>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleSubmitIntervalResults(); }}>
                {workoutIntervals.map((inv, idx) => (
                  <div
                    key={inv.id}
                    style={{
                      marginBottom: '1.25rem',
                      padding: '1rem',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>Interval {idx + 1}</div>
                    <div style={{ fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>{inv.title || `Interval ${idx + 1}`}</div>
                    {inv.description && (
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>{inv.description}</div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={intervalResultForm[inv.id] || ''}
                        onChange={(e) => setIntervalResultForm((prev) => ({ ...prev, [inv.id]: e.target.value }))}
                        placeholder="e.g., 2:15"
                        style={{ flex: 1, minWidth: '80px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '16px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => setDeleteIntervalConfirm({ isOpen: true, intervalId: inv.id })}
                        disabled={!intervalResultForm[inv.id]}
                        style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: intervalResultForm[inv.id] ? 'pointer' : 'not-allowed', opacity: intervalResultForm[inv.id] ? 1 : 0.5 }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowIntervalResultModal(false); setIntervalResultForm({}); }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">Save Results</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={deleteIntervalConfirm.isOpen}
          onConfirm={handleDeleteIntervalResult}
          onCancel={() => setDeleteIntervalConfirm({ isOpen: false, intervalId: null })}
          title="Delete Interval Result"
          message="Are you sure you want to delete this interval result?"
          confirmText={deletingIntervalId ? 'Deleting...' : 'Delete'}
          cancelText="Cancel"
          confirmDanger
        />

        {/* Cancel Confirmation Modal */}
        {showCancelModal && displayWorkout && (() => {
          let dateStr = workout.workout_date;
          if (typeof dateStr === 'string' && dateStr.includes('T')) {
            dateStr = dateStr.split('T')[0];
          }
          
          const workoutDateTime = dateStr && workout.workout_time
            ? combineDateTime(dateStr, workout.workout_time)
            : null;
          const hoursUntil = workoutDateTime ? getHoursUntil(workoutDateTime) : null;
          const within12Hours = workoutDateTime ? isWithinHours(workoutDateTime, 12) : false;

          return (
            <div className="modal-overlay">
              <div className="modal">
                <h2>Cancel Workout Signup</h2>
                <p>Are you sure you want to cancel your signup for this workout?</p>
                {within12Hours && hoursUntil !== null && (
                  <p className="warning-text">
                    <strong>⚠️ Warning:</strong> You are canceling less than 12 hours before this workout ({hoursUntil.toFixed(1)} hours remaining). 
                    This cancellation will count as an absence. 
                    Your absences are recorded and once you have three, you will be suspended from signing up for a week. 
                    This is to keep it fair for all members!
                  </p>
                )}
                {!within12Hours && hoursUntil !== null && hoursUntil > 0 && (
                  <p style={{ background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '8px', padding: '1rem', margin: '1rem 0', color: '#065f46' }}>
                    <strong>✓ Safe to Cancel:</strong> You are canceling more than 12 hours in advance ({hoursUntil.toFixed(1)} hours remaining). 
                    This cancellation will NOT count as an absence.
                  </p>
                )}
                {hoursUntil !== null && hoursUntil <= 0 && (
                  <p className="warning-text">
                    <strong>Note:</strong> This workout is in the past. Canceling will not affect your attendance record.
                  </p>
                )}
                <div className="modal-actions">
                  <button onClick={handleCancelSignup} className="btn btn-danger">Cancel Signup</button>
                  <button onClick={closeCancelModal} className="btn btn-secondary">Keep Booking</button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <ConfirmModal
        isOpen={deleteWorkoutConfirm.isOpen}
        onConfirm={confirmDeleteWorkout}
        onCancel={() => setDeleteWorkoutConfirm({ isOpen: false })}
        title="Delete Workout"
        message="Are you sure you want to delete this workout post?"
        confirmText="Delete"
        cancelText="Cancel"
        confirmDanger={true}
      />
    </div>
  );
};

export default WorkoutDetail;
