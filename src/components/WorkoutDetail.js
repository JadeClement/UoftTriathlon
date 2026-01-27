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
import { getFieldsForSport } from '../config/sportFields';
import { Capacitor } from '@capacitor/core';
import { addWorkoutToCalendar, hasWorkoutInCalendar } from '../services/calendarService';
import './WorkoutDetail.css';

const WorkoutDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isMember } = useAuth();
  
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
  const [testEvent, setTestEvent] = useState(null);
  const [testEventRecords, setTestEventRecords] = useState([]);
  const [showTestEventModal, setShowTestEventModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [testEventForm, setTestEventForm] = useState({
    title: '',
    sport: 'run',
    date: '',
    workout: ''
  });
  const [recordForm, setRecordForm] = useState({
    result: '',
    notes: '',
    user_id: null,
    result_fields: {}
  });
  // User selection state for coaches/admins when adding a result
  const [recordUserSearchQuery, setRecordUserSearchQuery] = useState('');
  const [recordUserSearchResults, setRecordUserSearchResults] = useState([]);
  const [showRecordUserDropdown, setShowRecordUserDropdown] = useState(false);
  const [selectedRecordUser, setSelectedRecordUser] = useState(null);

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

      console.log(`🔍 Loading workout details for ID: ${id}`);

      // Load workout details
      const workoutResponse = await fetch(`${API_BASE_URL}/forum/workouts/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (workoutResponse.ok) {
        const workoutData = await workoutResponse.json();
        console.log('🔍 Workout details loaded:', workoutData);
        console.log('🖼️ Author profile picture URL:', workoutData.workout?.authorProfilePictureUrl);
        
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
              console.log('🏊‍♂️ Swim members loaded:', swimMembersData);
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
        console.log('🔍 Attendance data loaded:', attendanceData);
        // If there are any attendance records, attendance has been submitted
        setAttendanceSaved(attendanceData.attendance && attendanceData.attendance.length > 0);
        console.log('📊 Attendance saved status:', attendanceData.attendance && attendanceData.attendance.length > 0);
        
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
        console.log('ℹ️ No attendance data found or error loading attendance');
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
        console.log('📋 Signups data received:', signupsData);
        console.log('👥 Individual signups:', signupsData.signups);
        
        // Debug profile picture URLs
        signupsData.signups.forEach((signup, index) => {
          console.log(`👤 Signup ${index + 1}:`, {
            name: signup.user_name,
            profilePictureUrl: signup.userProfilePictureUrl,
            hasProfilePicture: !!signup.userProfilePictureUrl
          });
        });
        
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

      // Load test event for this workout
      const testEventResponse = await fetch(`${API_BASE_URL}/test-events/by-workout/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (testEventResponse.ok) {
        const testEventData = await testEventResponse.json();
        setTestEvent(testEventData.testEvent);
        setTestEventRecords(testEventData.records || []);
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
  }, [API_BASE_URL, id, currentUser]);

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
        console.log('🔍 isWorkoutStarted: Missing workout data', { 
          hasWorkout: !!workoutToCheck, 
          workout_date: workoutToCheck?.workout_date, 
          workout_time: workoutToCheck?.workout_time 
        });
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
        console.log('🔍 isWorkoutStarted: Failed to create workout datetime', { 
          dateStr, 
          workout_time: workoutToCheck.workout_time 
        });
        return false;
      }
      
      // Compare workout datetime to current time
      const now = new Date();
      const hasStarted = workoutDateTime < now;
      
      console.log('🔍 isWorkoutStarted check:', {
        workout_date: workoutToCheck.workout_date,
        dateStr,
        workout_time: workoutToCheck.workout_time,
        workoutDateTimeISO: workoutDateTime.toISOString(),
        workoutDateTimeLocal: workoutDateTime.toString(),
        nowISO: now.toISOString(),
        nowLocal: now.toString(),
        diffMs: workoutDateTime - now,
        diffHours: (workoutDateTime - now) / (1000 * 60 * 60),
        hasStarted
      });
      
      return hasStarted;
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
      console.log('🔄 Loading workout details (ID changed or first load)');
      hasLoadedRef.current = true;
      lastWorkoutIdRef.current = id;
      loadWorkoutDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, navigate, isMember, id, cachedWorkout, loadWorkoutDetails]); // Removed 'workout' from deps to prevent infinite loop

  // Listen for profile updates to refresh profile pictures
  useEffect(() => {
    const handleProfileUpdate = (event) => {
      console.log('🔄 Profile updated event received, refreshing workout details...');
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
        console.log('🔍 Workout details loaded:', workoutData);
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
            console.log('🏊‍♂️ Swim members loaded:', swimMembersData);
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
        console.log('🔍 Attendance data loaded:', attendanceData);
        // If there are any attendance records, attendance has been submitted
        setAttendanceSaved(attendanceData.attendance && attendanceData.attendance.length > 0);
        console.log('📊 Attendance saved status:', attendanceData.attendance && attendanceData.attendance.length > 0);
        
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
        console.log('ℹ️ No attendance data found or error loading attendance');
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
        console.log('📋 Signups data received:', signupsData);
        console.log('👥 Individual signups:', signupsData.signups);
        
        // Debug profile picture URLs
        signupsData.signups.forEach((signup, index) => {
          console.log(`👤 Signup ${index + 1}:`, {
            name: signup.user_name,
            profilePictureUrl: signup.userProfilePictureUrl,
            hasProfilePicture: !!signup.userProfilePictureUrl
          });
        });
        
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
      showError(error.message || 'Failed to add workout to calendar');
    } finally {
      setCheckingCalendar(false);
    }
  };

  // Check if workout is in calendar on load
  useEffect(() => {
    const checkCalendarStatus = async () => {
      try {
        if (!displayWorkout || !displayWorkout.workout_date || !displayWorkout.workout_time) {
          return;
        }

        const isIOS = Capacitor.getPlatform() === 'ios';
        if (!isIOS) {
          return;
        }

        // First check localStorage for quick check
        try {
          const calendarEvents = JSON.parse(localStorage.getItem('calendarEvents') || '[]');
          if (calendarEvents.includes(displayWorkout.id)) {
            setIsInCalendar(true);
            return;
          }
        } catch (e) {
          // localStorage error - ignore
        }

        // Then check actual calendar (only if plugin is available)
        // This will gracefully fail if plugin isn't registered yet
        try {
          const hasEvent = await hasWorkoutInCalendar({
            id: displayWorkout.id,
            title: displayWorkout.title,
            workout_type: displayWorkout.workout_type,
            workout_date: displayWorkout.workout_date,
            workout_time: displayWorkout.workout_time
          });
          
          if (hasEvent) {
            setIsInCalendar(true);
            // Update localStorage
            try {
              const events = JSON.parse(localStorage.getItem('calendarEvents') || '[]');
              if (!events.includes(displayWorkout.id)) {
                events.push(displayWorkout.id);
                localStorage.setItem('calendarEvents', JSON.stringify(events));
              }
            } catch (e) {
              // localStorage error - ignore
            }
          }
        } catch (error) {
          // Calendar plugin not available - this is fine, just don't check
          // Don't log as error since plugin might not be set up yet
        }
      } catch (error) {
        // Catch any unexpected errors to prevent component crash
        console.error('Error in checkCalendarStatus:', error);
      }
    };

    checkCalendarStatus();
  }, [displayWorkout]);
  /* eslint-enable no-use-before-define */

  const handleAttendanceChange = (userId, isPresent) => {
    console.log('📝 Attendance change:', { userId, isPresent, type: typeof userId });
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
    console.log('📝 Late status change:', { userId, isLate, type: typeof userId });
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
        const result = await response.json();
        console.log('Attendance saved successfully:', result.message);
        // Exit edit mode after successful submission
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

  // User search helpers for coaches/admins when adding a result
  const searchRecordUsers = async (query) => {
    if (!query || query.length < 2) {
      setRecordUserSearchResults([]);
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(
        `${API_BASE_URL}/admin/members?search=${encodeURIComponent(query)}&limit=10`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setRecordUserSearchResults(data.members || []);
      }
    } catch (error) {
      console.error('Error searching users for test result:', error);
    }
  };

  const handleRecordUserSearchChange = (e) => {
    const query = e.target.value;
    setRecordUserSearchQuery(query);
    if (query) {
      searchRecordUsers(query);
      setShowRecordUserDropdown(true);
    } else {
      setRecordUserSearchResults([]);
      setShowRecordUserDropdown(false);
      setSelectedRecordUser(null);
      setRecordForm((prev) => ({ ...prev, user_id: null }));
    }
  };

  const selectRecordUser = (user) => {
    setSelectedRecordUser(user);
    setRecordUserSearchQuery(user.name || user.email);
    setRecordForm((prev) => ({ ...prev, user_id: user.id }));
    setShowRecordUserDropdown(false);
    setRecordUserSearchResults([]);
  };

  // Test Event functions
  const handleCreateTestEvent = async () => {
    if (!testEventForm.title || !testEventForm.sport || !testEventForm.date || !testEventForm.workout) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/test-events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...testEventForm,
          workout_post_id: parseInt(id)
        })
      });

      if (response.ok) {
        const data = await response.json().catch(() => null);

        // Optimistically update local state so the UI reflects the new test event
        if (data && data.testEvent) {
          setTestEvent(data.testEvent);
          setTestEventRecords([]);
        }

        showSuccess('Test event created successfully!');
        setShowTestEventModal(false);
        setTestEventForm({ title: '', sport: 'run', date: '', workout: '' });
        // Also reload from the backend to stay in sync
        loadWorkoutDetails();
      } else {
        const error = await response.json();
        showError(`Failed to create test event: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating test event:', error);
      showError('Error creating test event');
    }
  };

  const handleAddRecord = async () => {
    if (!recordForm.result) {
      showError('Please enter a result');
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      const payload = {
        test_event_id: testEvent.id,
        title: testEvent.title,
        result: recordForm.result,
        notes: recordForm.notes,
        result_fields: recordForm.result_fields || {}
      };

      // Only allow coaches/admins to specify a different user_id
      if (isCoachOrAdmin && recordForm.user_id) {
        payload.user_id = recordForm.user_id;
      }

      const response = await fetch(`${API_BASE_URL}/records`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        showSuccess('Result added successfully!');
        setShowRecordModal(false);
        setRecordForm({ result: '', notes: '', user_id: null, result_fields: {} });
        setSelectedRecordUser(null);
        setRecordUserSearchQuery('');
        setRecordUserSearchResults([]);
        setShowRecordUserDropdown(false);
        loadWorkoutDetails();
      } else {
        const error = await response.json();
        // Check for duplicate record error
        if (error.error === 'duplicate_record') {
          showError(error.message || 'Whoops! You already have a result for this test event. Please edit that one instead.');
        } else {
          showError(`Failed to add result: ${error.error}`);
        }
      }
    } catch (error) {
      console.error('Error adding record:', error);
      showError('Error adding result');
    }
  };

  const openTestEventModal = () => {
    // Pre-fill form with workout info
    const workoutToCheck = displayWorkout || workout;
    const workoutDate = workoutToCheck.workout_date ? workoutToCheck.workout_date.split('T')[0] : '';
    const sportMap = {
      'swim': 'swim',
      'spin': 'bike',
      'outdoor-ride': 'bike',
      'brick': 'bike',
      'run': 'run'
    };
    const mappedSport = sportMap[workoutToCheck.workout_type] || 'run';
    
    setTestEventForm({
      title: workoutToCheck.title || '',
      sport: mappedSport,
      date: workoutDate,
      workout: workoutToCheck.content || ''
    });
    setShowTestEventModal(true);
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
    <div className="workout-detail-container">
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
                  console.log('🖼️ Display workout authorProfilePictureUrl:', displayWorkout.authorProfilePictureUrl);
                  const url = normalizeProfileImageUrl(displayWorkout.authorProfilePictureUrl);
                  console.log('🖼️ Normalized URL:', url);
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
                  console.log('🔍 Edit button clicked, workout:', displayWorkout);
                  if (displayWorkout) {
                    startEdit(displayWorkout);
                    setEditMode(true);
                    console.log('✅ Edit mode activated, editForm should be:', editForm);
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
                  disabled={checkingCalendar}
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
                              console.log('🔍 Checkbox change for member:', member);
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
                                console.log('🔍 Late checkbox change for member:', member);
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
                              console.log('🔍 Checkbox change for signup:', signup);
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

        {/* Test Event / Results Section */}
        <div className="test-event-section" style={{ marginTop: '2rem', background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, color: '#374151' }}>Test Results</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {/* Show "Create Test Event" button for coaches/admins only if no test event exists */}
              {!testEvent && currentUser && (currentUser.role === 'coach' || currentUser.role === 'administrator') && (
                <button 
                  className="new-post-btn" 
                  onClick={openTestEventModal}
                >
                  +<span className="btn-text"> Create Test Event</span>
                </button>
              )}
              {/* Show \"Add Test Result\" button if test event exists and user is a member/coach/admin */}
              {testEvent && currentUser && (currentUser.role === 'member' || currentUser.role === 'coach' || currentUser.role === 'exec' || currentUser.role === 'administrator') && (
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    setShowRecordModal(true);
                    setRecordForm({ result: '', notes: '', user_id: null, result_fields: {} });
                    setSelectedRecordUser(null);
                    setRecordUserSearchQuery('');
                    setRecordUserSearchResults([]);
                    setShowRecordUserDropdown(false);
                  }}
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  + Add Test Result
                </button>
              )}
            </div>
          </div>

          {!testEvent ? (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>
              {currentUser && (currentUser.role === 'coach' || currentUser.role === 'administrator')
                ? 'No test event linked to this workout. Click "Create Test Event" to add one.'
                : 'No test event linked to this workout.'}
            </p>
          ) : (
            <>
              <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>{testEvent.title}</h3>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.875rem', color: '#6b7280' }}>
                  <span><strong>Sport:</strong> <span className={`sport-badge ${testEvent.sport}`} style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500, textTransform: 'capitalize' }}>{testEvent.sport}</span></span>
                  <span><strong>Date:</strong> {new Date(testEvent.date).toLocaleDateString()}</span>
                  <span><strong>Workout:</strong> {testEvent.workout}</span>
                </div>
              </div>

              {currentUser && (
                <>
                  {isCoachOrAdmin ? (
                    // Coaches/admins see all results
                    <>
                      {testEventRecords.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Name</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Result</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Notes</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {testEventRecords.map(record => {
                                // Parse result_fields if available
                                let resultFields = {};
                                if (record.result_fields) {
                                  try {
                                    resultFields = typeof record.result_fields === 'string' 
                                      ? JSON.parse(record.result_fields) 
                                      : record.result_fields;
                                  } catch (e) {
                                    resultFields = {};
                                  }
                                }
                                const sport = testEvent?.sport;
                                const fields = sport ? getFieldsForSport(sport) : [];
                                const hasFields = fields.length > 0 && Object.keys(resultFields).length > 0;
                                
                                return (
                                  <tr key={record.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '0.75rem', color: '#475569' }}>{record.user_name}</td>
                                    <td style={{ padding: '0.75rem', color: '#475569' }}>
                                      {record.result || '-'}
                                      {hasFields && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                                          {fields.map(field => {
                                            const value = resultFields[field.key];
                                            if (value === null || value === undefined || value === '') return null;
                                            return (
                                              <div key={field.key} style={{ marginTop: '0.25rem' }}>
                                                <strong>{field.label}:</strong> {Array.isArray(value) ? value.join(', ') : value}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </td>
                                    <td style={{ padding: '0.75rem', color: '#475569' }}>{record.notes || '-'}</td>
                                    <td style={{ padding: '0.75rem', color: '#475569' }}>{new Date(record.created_at).toLocaleDateString()}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>No results yet. Be the first to add one!</p>
                      )}
                    </>
                  ) : (
                    // Regular members/execs see public results + their own results (already filtered by backend)
                    <>
                      {testEventRecords.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Name</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Result</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Notes</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {testEventRecords.map(record => {
                                // Parse result_fields if available
                                let resultFields = {};
                                if (record.result_fields) {
                                  try {
                                    resultFields = typeof record.result_fields === 'string' 
                                      ? JSON.parse(record.result_fields) 
                                      : record.result_fields;
                                  } catch (e) {
                                    resultFields = {};
                                  }
                                }
                                const sport = testEvent?.sport;
                                const fields = sport ? getFieldsForSport(sport) : [];
                                const hasFields = fields.length > 0 && Object.keys(resultFields).length > 0;
                                
                                return (
                                  <tr key={record.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '0.75rem', color: '#475569' }}>{record.user_name}</td>
                                    <td style={{ padding: '0.75rem', color: '#475569' }}>
                                      {record.result || '-'}
                                      {hasFields && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                                          {fields.map(field => {
                                            const value = resultFields[field.key];
                                            if (value === null || value === undefined || value === '') return null;
                                            return (
                                              <div key={field.key} style={{ marginTop: '0.25rem' }}>
                                                <strong>{field.label}:</strong> {Array.isArray(value) ? value.join(', ') : value}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </td>
                                    <td style={{ padding: '0.75rem', color: '#475569' }}>{record.notes || '-'}</td>
                                    <td style={{ padding: '0.75rem', color: '#475569' }}>{new Date(record.created_at).toLocaleDateString()}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>
                          No result recorded yet. Click "Add Test Result" to add yours.
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>

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

        {/* Create Test Event Modal */}
        {showTestEventModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h2>Create Test Event</h2>
              <form onSubmit={(e) => { e.preventDefault(); handleCreateTestEvent(); }}>
                <div className="form-group">
                  <label>Title:</label>
                  <input
                    type="text"
                    value={testEventForm.title}
                    onChange={(e) => setTestEventForm({...testEventForm, title: e.target.value})}
                    required
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                </div>
                <div className="form-group">
                  <label>Sport:</label>
                  <select
                    value={testEventForm.sport}
                    onChange={(e) => setTestEventForm({...testEventForm, sport: e.target.value})}
                    required
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                  >
                    <option value="swim">Swim</option>
                    <option value="bike">Bike</option>
                    <option value="run">Run</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Date:</label>
                  <input
                    type="date"
                    value={testEventForm.date}
                    onChange={(e) => setTestEventForm({...testEventForm, date: e.target.value})}
                    required
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                </div>
                <div className="form-group">
                  <label>Workout Description:</label>
                  <textarea
                    rows="3"
                    value={testEventForm.workout}
                    onChange={(e) => setTestEventForm({...testEventForm, workout: e.target.value})}
                    placeholder="e.g., 5 400ms fast on the track"
                    required
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setShowTestEventModal(false);
                    setTestEventForm({ title: '', sport: 'run', date: '', workout: '' });
                  }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Test Event
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Record Modal */}
        {showRecordModal && testEvent && (
          <div className="modal-overlay">
            <div className="modal">
              <h2>Add My Result</h2>
              <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#374151' }}>{testEvent.title}</h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>{testEvent.workout}</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleAddRecord(); }}>
                {isCoachOrAdmin && (
                  <div className="form-group">
                    <label>Athlete:</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        value={recordUserSearchQuery}
                        onChange={handleRecordUserSearchChange}
                        placeholder="Search members by name or email"
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                      />
                      {showRecordUserDropdown && recordUserSearchResults.length > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '0.5rem',
                          marginTop: '0.25rem',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          zIndex: 10,
                          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                        }}>
                          {recordUserSearchResults.map(user => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => selectRecordUser(user)}
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '0.5rem 0.75rem',
                                border: 'none',
                                background: selectedRecordUser && selectedRecordUser.id === user.id ? '#eff6ff' : 'white',
                                cursor: 'pointer',
                                fontSize: '0.875rem'
                              }}
                            >
                              <div style={{ fontWeight: 500, color: '#111827' }}>{user.name || user.email}</div>
                              {user.name && user.email && (
                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{user.email}</div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <small style={{ color: '#6b7280' }}>Leave blank to use your own name.</small>
                  </div>
                )}
                
                {/* Sport-specific fields */}
                {testEvent && (() => {
                  const sport = testEvent.sport;
                  const sportFields = sport ? getFieldsForSport(sport) : [];
                  
                  if (sportFields.length > 0) {
                    return (
                      <div className="form-group" style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                        <label style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#374151', display: 'block' }}>
                          {sport.charAt(0).toUpperCase() + sport.slice(1)}-Specific Details:
                        </label>
                        {sportFields.map(field => (
                          <div key={field.key} style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                              {field.label}:
                            </label>
                            {field.type === 'array' ? (
                              <input
                                type="text"
                                value={Array.isArray(recordForm.result_fields?.[field.key]) 
                                  ? recordForm.result_fields[field.key].join(', ') 
                                  : (recordForm.result_fields?.[field.key] || '')}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const arrayValue = value ? value.split(',').map(v => v.trim()).filter(v => v) : [];
                                  setRecordForm({
                                    ...recordForm,
                                    result_fields: {
                                      ...recordForm.result_fields,
                                      [field.key]: arrayValue.length > 0 ? arrayValue : null
                                    }
                                  });
                                }}
                                placeholder={field.placeholder}
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                              />
                            ) : field.type === 'number' ? (
                              <input
                                type="number"
                                value={recordForm.result_fields?.[field.key] || ''}
                                onChange={(e) => {
                                  const value = e.target.value === '' ? null : parseFloat(e.target.value);
                                  setRecordForm({
                                    ...recordForm,
                                    result_fields: {
                                      ...recordForm.result_fields,
                                      [field.key]: value
                                    }
                                  });
                                }}
                                placeholder={field.placeholder}
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                              />
                            ) : (
                              <input
                                type="text"
                                value={recordForm.result_fields?.[field.key] || ''}
                                onChange={(e) => {
                                  setRecordForm({
                                    ...recordForm,
                                    result_fields: {
                                      ...recordForm.result_fields,
                                      [field.key]: e.target.value || null
                                    }
                                  });
                                }}
                                placeholder={field.placeholder}
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                              />
                            )}
                            {field.helpText && (
                              <small style={{ color: '#6b7280', display: 'block', marginTop: '0.25rem', fontSize: '0.75rem' }}>
                                {field.helpText}
                              </small>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })()}
                
                <div className="form-group">
                  <label>Result:</label>
                  <textarea
                    rows="3"
                    value={recordForm.result}
                    onChange={(e) => setRecordForm({...recordForm, result: e.target.value})}
                    placeholder="e.g., 1:20, 1:18, 1:19, 1:17, 1:16"
                    required
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                  <small style={{ color: '#6b7280' }}>Text description of times/results</small>
                </div>
                <div className="form-group">
                  <label>Notes (optional):</label>
                  <textarea
                    rows="3"
                    value={recordForm.notes}
                    onChange={(e) => setRecordForm({...recordForm, notes: e.target.value})}
                    placeholder="Additional notes..."
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setShowRecordModal(false);
                    setRecordForm({ result: '', notes: '', user_id: null, result_fields: {} });
                    setSelectedRecordUser(null);
                    setRecordUserSearchQuery('');
                    setRecordUserSearchResults([]);
                    setShowRecordUserDropdown(false);
                  }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Add Result
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cancel Confirmation Modal */}
        {showCancelModal && displayWorkout && (() => {
          // Calculate hours until workout
          console.log('🔍 Cancel modal calculation:', {
            workout_date: workout.workout_date,
            workout_time: workout.workout_time,
            workout_date_type: typeof workout.workout_date,
            workout: workout
          });
          
          // Extract just the date part if workout_date is an ISO string
          let dateStr = workout.workout_date;
          if (typeof dateStr === 'string' && dateStr.includes('T')) {
            dateStr = dateStr.split('T')[0];
            console.log('🔍 Extracted date from ISO string:', { original: workout.workout_date, extracted: dateStr });
          }
          
          const workoutDateTime = dateStr && workout.workout_time 
            ? combineDateTime(dateStr, workout.workout_time)
            : null;
          
          console.log('🔍 Workout datetime result:', { 
            workoutDateTime,
            workoutDateTimeISO: workoutDateTime?.toISOString(),
            workoutDateTimeLocal: workoutDateTime?.toString()
          });
          
          const hoursUntil = workoutDateTime ? getHoursUntil(workoutDateTime) : null;
          const within12Hours = workoutDateTime ? isWithinHours(workoutDateTime, 12) : false;
          
          console.log('🔍 Final calculation:', { 
            hoursUntil, 
            within12Hours,
            nowISO: new Date().toISOString(),
            nowLocal: new Date().toString(),
            workoutIsInPast: hoursUntil !== null && hoursUntil <= 0
          });
          
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
