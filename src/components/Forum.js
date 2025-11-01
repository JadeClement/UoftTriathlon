import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useWorkoutEdit } from '../hooks/useWorkoutEdit';
import { showSuccess, showError, showWarning } from './SimpleNotification';
import './Forum.css';

const Forum = () => {
  const { currentUser, isMember, isExec, isCoach, getUserRole } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('workouts');
  const [workoutPosts, setWorkoutPosts] = useState([]);
  const [allLoadedWorkouts, setAllLoadedWorkouts] = useState([]); // Store all loaded workouts from backend
  const [workoutsFullyLoaded, setWorkoutsFullyLoaded] = useState(false); // Track if we've loaded all workouts
  const [eventPosts, setEventPosts] = useState([]);
  const [newWorkout, setNewWorkout] = useState('');
  const [newEvent, setNewEvent] = useState('');
  const [loading, setLoading] = useState(true);
  const [showWorkoutForm, setShowWorkoutForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [workoutFilter, setWorkoutFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('upcoming'); // 'upcoming' | 'past'
  const [pastPage, setPastPage] = useState(1);
  const [pastPagination, setPastPagination] = useState({ currentPage: 1, totalPages: 1, totalPosts: 0, hasMore: false });
  const [workoutForm, setWorkoutForm] = useState({
    title: '',
    type: 'spin',
    date: '',
    time: '',
    content: '',
    capacity: ''
  });
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    content: ''
  });
  // Inline edit state for events (admin/exec)
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventEditForm, setEventEditForm] = useState({
    title: '',
    date: '',
    content: ''
  });
  const [savingEvent, setSavingEvent] = useState(false);
  const [workoutSignups, setWorkoutSignups] = useState({});
  const [workoutWaitlists, setWorkoutWaitlists] = useState({});
  const [eventRsvps, setEventRsvps] = useState({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [workoutToCancel, setWorkoutToCancel] = useState(null);
  const [showPromotionMessage, setShowPromotionMessage] = useState(false);
  const [promotedWorkout, setPromotedWorkout] = useState(null);
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  
  // Reload when time filter or past page changes
  useEffect(() => {
    if (isMember(currentUser)) {
      loadForumPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter, pastPage]);

  // Reset to page 1 when filters change (so pagination starts fresh)
  useEffect(() => {
    setPastPage(1);
    // When workout filter changes, reload workouts if we're on past view
    // This ensures we load enough workouts for the new filter
    if (timeFilter === 'past' && isMember(currentUser)) {
      loadForumPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutFilter]);
  
  // Function to check if a workout type is allowed for the user's sport
  const isWorkoutTypeAllowed = (workoutType) => {
    console.log('🔍 isWorkoutTypeAllowed debug:', {
      currentUser: currentUser,
      sport: currentUser?.sport,
      workoutType: workoutType
    });
    
    if (!currentUser || !currentUser.sport) {
      console.log('🔍 No sport preference, showing all workouts');
      return true; // Show all if no sport preference
    }
    
    const sport = currentUser.sport;
    const isAllowed = (() => {
      switch (sport) {
        case 'run_only':
          return workoutType === 'run';
        case 'duathlon':
          return ['run', 'outdoor-ride', 'brick', 'spin'].includes(workoutType);
        case 'triathlon':
          return ['run', 'outdoor-ride', 'brick', 'swim', 'spin'].includes(workoutType);
        default:
          return true; // Show all for unknown sports
      }
    })();
    
    console.log('🔍 Sport filtering result:', { sport, workoutType, isAllowed });
    return isAllowed;
  };

  // Function to get allowed workout types for the current user's sport
  const getAllowedWorkoutTypes = () => {
    if (!currentUser || !currentUser.sport) {
      // Show all types if no sport preference
      return [
        { value: 'spin', label: 'Spin' },
        { value: 'outdoor-ride', label: 'Outdoor Ride' },
        { value: 'run', label: 'Run' },
        { value: 'swim', label: 'Swim' },
        { value: 'brick', label: 'Brick (Bike + Run)' },
        { value: 'other', label: 'Other' }
      ];
    }
    
    const sport = currentUser.sport;
    
    switch (sport) {
      case 'run_only':
        return [
          { value: 'run', label: 'Run' },
          { value: 'other', label: 'Other' }
        ];
      case 'duathlon':
        return [
          { value: 'run', label: 'Run' },
          { value: 'outdoor-ride', label: 'Outdoor Ride' },
          { value: 'brick', label: 'Brick (Bike + Run)' },
          { value: 'spin', label: 'Spin' },
          { value: 'other', label: 'Other' }
        ];
      case 'triathlon':
        return [
          { value: 'run', label: 'Run' },
          { value: 'outdoor-ride', label: 'Outdoor Ride' },
          { value: 'brick', label: 'Brick (Bike + Run)' },
          { value: 'swim', label: 'Swim' },
          { value: 'spin', label: 'Spin' },
          { value: 'other', label: 'Other' }
        ];
      default:
        return [
          { value: 'spin', label: 'Spin' },
          { value: 'outdoor-ride', label: 'Outdoor Ride' },
          { value: 'run', label: 'Run' },
          { value: 'swim', label: 'Swim' },
          { value: 'brick', label: 'Brick (Bike + Run)' },
          { value: 'other', label: 'Other' }
        ];
    }
  };
  
  const { 
    editingWorkout, 
    editForm, 
    saving, 
    startEdit, 
    cancelEdit, 
    updateField, 
    saveWorkout 
  } = useWorkoutEdit(API_BASE_URL);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    // If user is at least member, load posts. If pending, we'll render a gate message.
    if (isMember(currentUser)) {
      loadForumPosts();
    } else {
      // Ensure we don't stay stuck on loading for pending users
      setLoading(false);
    }
  }, [currentUser, navigate, isMember]);

  // Listen for profile updates to refresh profile pictures
  useEffect(() => {
    const handleProfileUpdate = (event) => {
      console.log('🔄 Profile updated event received in Forum, refreshing posts...');
      loadForumPosts();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  // Check for tab query parameter and set active tab accordingly
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    
    if (tabParam === 'events') {
      setActiveTab('events');
    } else if (tabParam === 'workouts') {
      setActiveTab('workouts');
    }
    // If no tab param or invalid value, default to 'workouts' (existing behavior)
  }, []);

  const loadForumPosts = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      // Load workout posts - load in batches until we have enough filtered results
      setWorkoutsLoading(true);
      
      // Reset loaded workouts when filters change
      if (timeFilter === 'past') {
        setAllLoadedWorkouts([]);
        setWorkoutsFullyLoaded(false);
      }
      
      let allWorkouts = [];
      let page = 1;
      let hasMore = true;
      const limit = 20; // Load 20 at a time
      
      // For upcoming workouts, just load once (no pagination needed client-side)
      if (timeFilter === 'upcoming') {
        const qp = new URLSearchParams();
        qp.set('type', 'workout');
        qp.set('time', 'upcoming');
        
        const workoutResponse = await fetch(`${API_BASE_URL}/forum/posts?${qp.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (workoutResponse.ok) {
          const workoutData = await workoutResponse.json();
          const posts = workoutData.posts || [];
          const validPosts = posts.filter(post => post && post.id && typeof post === 'object');
          allWorkouts = validPosts;
        }
      } else {
        // For past workouts, load pages until we have enough filtered results
        const itemsPerPage = 4;
        const minNeededForFirstPage = itemsPerPage; // We want at least 4 workouts after filtering
        const targetCount = itemsPerPage * 2; // Load enough for 2 pages (8 items) to be safe
        
        while (hasMore) {
          const qp = new URLSearchParams();
          qp.set('type', 'workout');
          qp.set('time', 'past');
          qp.set('page', String(page));
          qp.set('limit', String(limit));
          
          const workoutResponse = await fetch(`${API_BASE_URL}/forum/posts?${qp.toString()}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!workoutResponse.ok) break;
          
          const workoutData = await workoutResponse.json();
          const posts = workoutData.posts || [];
          const validPosts = posts.filter(post => post && post.id && typeof post === 'object');
          
          if (validPosts.length === 0) {
            hasMore = false;
            break;
          }
          
          allWorkouts = [...allWorkouts, ...validPosts];
          
          // Check if we have enough after applying client-side filters
          // We'll apply the filters that we can determine here (sport and workout type)
          const filteredCount = allWorkouts.filter(post => {
            // Apply sport filter if user has sport preference
            if (currentUser?.sport) {
              const sport = currentUser.sport;
              let workoutTypeAllowed = true;
              
              switch (sport) {
                case 'run_only':
                  workoutTypeAllowed = post.workout_type === 'run';
                  break;
                case 'duathlon':
                  workoutTypeAllowed = ['run', 'outdoor-ride', 'brick', 'spin'].includes(post.workout_type);
                  break;
                case 'triathlon':
                  workoutTypeAllowed = ['run', 'outdoor-ride', 'brick', 'swim', 'spin'].includes(post.workout_type);
                  break;
                default:
                  workoutTypeAllowed = true;
              }
              
              if (!workoutTypeAllowed) return false;
            }
            
            // Apply workout type filter if not 'all'
            if (workoutFilter !== 'all') {
              switch (workoutFilter) {
                case 'bike':
                  if (!['spin', 'outdoor-ride', 'brick'].includes(post.workout_type)) return false;
                  break;
                case 'swim':
                  if (post.workout_type !== 'swim') return false;
                  break;
                case 'run':
                  if (post.workout_type !== 'run') return false;
                  break;
              }
            }
            
            return true;
          }).length;
          
          // Check if we should load more
          const pagination = workoutData.pagination;
          hasMore = pagination?.hasMore || false;
          
          // If we have enough filtered workouts for at least 2 pages (8 items), we can stop
          // This ensures the first page will be full and pagination will work correctly
          if (filteredCount >= targetCount) {
            break;
          }
          
          // If there's no more data, stop anyway
          if (!hasMore) break;
          page++;
          
          // Safety limit to prevent infinite loops
          if (page > 50) break;
        }
      }
      
      setAllLoadedWorkouts(allWorkouts);
      setWorkoutPosts(allWorkouts);
      setWorkoutsFullyLoaded(!hasMore || timeFilter === 'upcoming');
        
        // Do not load per-workout signups/waitlists here; fetch on demand in detail view
      }

      // Load event posts only when Events tab is active to speed up initial load
      if (activeTab === 'events') {
        setEventsLoading(true);
        const eventResponse = await fetch(`${API_BASE_URL}/forum/posts?type=event`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (eventResponse.ok) {
          const eventData = await eventResponse.json();
          console.log('🔍 Event data received:', eventData);
          
          // Ensure we have valid posts data
          const posts = eventData.posts || eventData || [];
          console.log('🔍 Event posts to set:', posts);
          
          // Filter out any invalid posts
          const validPosts = posts.filter(post => post && post.id && typeof post === 'object');
          console.log('🔍 Valid event posts:', validPosts);
          
          setEventPosts(validPosts);
        }
      }
    } catch (error) {
      console.error('Error loading forum posts:', error);
    } finally {
      setLoading(false);
      setWorkoutsLoading(false);
      setEventsLoading(false);
    }
  };

  // When switching to Events tab, fetch events on demand
  useEffect(() => {
    if (activeTab === 'events' && isMember(currentUser)) {
      loadForumPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadWorkoutSignups = async (workouts) => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) return;

      const signupsData = {};
      
      for (const workout of workouts) {
        const signupsResponse = await fetch(`${API_BASE_URL}/forum/workouts/${workout.id}/signups`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (signupsResponse.ok) {
          const data = await signupsResponse.json();
          signupsData[workout.id] = data.signups || [];
          console.log(`🔍 Workout ${workout.id} signups:`, data.signups || []);
        }
      }
      
      setWorkoutSignups(signupsData);
      console.log('📊 All workout signups loaded:', signupsData);
      console.log('🔍 Current workoutSignups state structure:', Object.keys(signupsData).map(key => ({
        workoutId: key,
        signupCount: signupsData[key]?.length || 0,
        signups: signupsData[key] || []
      })));
    } catch (error) {
      console.error('Error loading workout signups:', error);
    }
  };

  const loadWorkoutWaitlists = async (workouts) => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) return;

      const waitlistData = {};
      
      for (const workout of workouts) {
        const waitlistResponse = await fetch(`${API_BASE_URL}/forum/workouts/${workout.id}/waitlist`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (waitlistResponse.ok) {
          const data = await waitlistResponse.json();
          waitlistData[workout.id] = data.waitlist || [];
        }
      }
      
      setWorkoutWaitlists(waitlistData);
    } catch (error) {
      console.error('Error loading workout waitlists:', error);
    }
  };

  const loadEventRsvps = async (events) => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) return;

      const rsvpsData = {};
      
      for (const event of events) {
        const rsvpsResponse = await fetch(`${API_BASE_URL}/forum/events/${event.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (rsvpsResponse.ok) {
          const data = await rsvpsResponse.json();
          rsvpsData[event.id] = data.rsvps || [];
          console.log(`🔍 Event ${event.id} RSVPs:`, data.rsvps || []);
        }
      }
      
      setEventRsvps(rsvpsData);
      console.log('📊 All event RSVPs loaded:', rsvpsData);
    } catch (error) {
      console.error('Error loading event RSVPs:', error);
    }
  };

  // Event edit helpers
  const startEventEdit = (eventPost) => {
    setEditingEvent(eventPost.id);
    setEventEditForm({
      title: eventPost.title || '',
      date: eventPost.event_date ? String(eventPost.event_date).split('T')[0] : '',
      content: eventPost.content || ''
    });
  };

  const cancelEventEdit = () => {
    setEditingEvent(null);
    setEventEditForm({ title: '', date: '', content: '' });
  };

  const updateEventField = (field, value) => {
    setEventEditForm(prev => ({ ...prev, [field]: value }));
  };

  const saveEvent = async (eventId) => {
    try {
      setSavingEvent(true);
      const token = localStorage.getItem('triathlonToken');
      if (!token) throw new Error('No authentication token found');

      const body = {
        title: eventEditForm.title,
        eventDate: eventEditForm.date,
        content: eventEditForm.content
      };

      const response = await fetch(`${API_BASE_URL}/forum/posts/${eventId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update event');
      }

      setSavingEvent(false);
      setEditingEvent(null);
      await loadForumPosts();
    } catch (error) {
      console.error('Error updating event:', error);
      setSavingEvent(false);
      alert(error.message || 'Error updating event');
    }
  };

  const handleWorkoutSignUp = async (workoutId) => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      // Check if user is already signed up
      const isCurrentlySignedUp = isUserSignedUp(workoutId);
      
      if (!isCurrentlySignedUp) {
        // Check capacity limit before allowing sign-up
        const workout = workoutPosts.find(w => w.id === workoutId);
        if (workout && workout.capacity) {
          const currentSignups = workoutSignups[workoutId]?.length || 0;
          if (currentSignups >= workout.capacity) {
            showWarning(`Sorry, this workout is full! Maximum capacity: ${workout.capacity} people.`);
            return;
          }
        }
      }

      const response = await fetch(`${API_BASE_URL}/forum/workouts/${workoutId}/signup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        
        // Reload signup data from backend to ensure accuracy
        await loadWorkoutSignups(workoutPosts);
        
        // Also reload waitlist data in case someone was promoted
        await loadWorkoutWaitlists(workoutPosts);
      } else {
        const error = await response.json();
        console.error('Error updating signup:', error.error);
      }
    } catch (error) {
      console.error('Error updating signup:', error);
    }
  };

  const isUserSignedUp = (workoutId) => {
    if (!workoutId) return false;
    const signups = workoutSignups[workoutId] || [];
    return signups.some(signup => signup && signup.user_id === currentUser.id);
  };

  const isWorkoutFull = (workoutId) => {
    if (!workoutId) return false;
    const workout = workoutPosts.find(w => w && w.id === workoutId);
    if (!workout || !workout.capacity) return false;
    const currentSignups = workoutSignups[workoutId]?.length || 0;
    return currentSignups >= workout.capacity;
  };

  const isWorkoutArchived = (post) => {
    if (!post || !post.workout_date) return false;
    try {
      // Parse the workout date and get just the date part (YYYY-MM-DD)
      const workoutDate = new Date(post.workout_date);
      if (isNaN(workoutDate.getTime())) return false;
      
      // Get today's date in the same timezone as the workout date
      const today = new Date();
      
      // Compare dates by converting both to YYYY-MM-DD format
      const workoutDateStr = workoutDate.toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];
      
      return workoutDateStr < todayStr;
    } catch (_) {
      return false;
    }
  };

  const isUserOnWaitlist = (workoutId) => {
    if (!workoutId) return false;
    return workoutWaitlists[workoutId]?.some(waitlist => waitlist && waitlist.user_id === currentUser.id) || false;
  };

  // Returns 1-based position or null if not on waitlist
  const getWaitlistPosition = (workoutId) => {
    if (!workoutId) return null;
    const list = workoutWaitlists[workoutId] || [];
    const idx = list.findIndex(w => w && w.user_id === currentUser.id);
    return idx === -1 ? null : idx + 1;
  };

  const formatOrdinal = (n) => {
    if (n == null) return '';
    const s = ["th","st","nd","rd"], v = n % 100;
    return n + (s[(v-20)%10] || s[v] || s[0]);
  };

  // Event RSVP functions
  const handleEventRsvp = async (eventId, status) => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      // Call backend API to save RSVP
      const response = await fetch(`${API_BASE_URL}/forum/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update local state based on backend response
        const currentRsvps = eventRsvps[eventId] || [];
        
        if (result.status === null) {
          // RSVP was removed
          const filteredRsvps = currentRsvps.filter(r => r.user_id !== currentUser.id);
          setEventRsvps(prev => ({
            ...prev,
            [eventId]: filteredRsvps
          }));
        } else {
          // RSVP was added/updated
          const filteredRsvps = currentRsvps.filter(r => r.user_id !== currentUser.id);
          const newRsvp = {
            id: Date.now(),
            user_id: currentUser.id,
            user_name: currentUser.name,
            status: result.status,
            signed_up_at: new Date().toISOString().split('T')[0]
          };
          setEventRsvps(prev => ({
            ...prev,
            [eventId]: [...filteredRsvps, newRsvp]
          }));
        }
        
        console.log('Event RSVP updated:', result);
      } else {
        const error = await response.json();
        console.error('Error updating RSVP:', error.error);
        alert(error.error || 'Error updating RSVP');
      }
    } catch (error) {
      console.error('Error updating event RSVP:', error);
      alert('Error updating RSVP');
    }
  };

  const getUserRsvpStatus = (eventId) => {
    if (!eventId) return null;
    const rsvps = eventRsvps[eventId] || [];
    const userRsvp = rsvps.find(rsvp => rsvp.user_id === currentUser.id);
    return userRsvp ? userRsvp.status : null;
  };

  const handleWaitlistJoin = async (workoutId) => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/forum/workouts/${workoutId}/waitlist`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Refresh waitlist data
        await loadWorkoutWaitlists(workoutPosts);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to join waitlist');
      }
    } catch (error) {
      console.error('Error joining waitlist:', error);
      alert('Failed to join waitlist');
    }
  };

  const handleWaitlistLeave = async (workoutId) => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/forum/workouts/${workoutId}/waitlist`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Refresh waitlist data
        await loadWorkoutWaitlists(workoutPosts);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to leave waitlist');
      }
    } catch (error) {
      console.error('Error leaving waitlist:', error);
      alert('Failed to leave waitlist');
    }
  };

  const handleCancelClick = (workoutId) => {
    setWorkoutToCancel(workoutId);
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async () => {
    if (!workoutToCancel) return;
    
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/forum/workouts/${workoutToCancel}/signup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Refresh both signup and waitlist data since someone might have been promoted
        await loadWorkoutSignups(workoutPosts);
        await loadWorkoutWaitlists(workoutPosts);
        setShowCancelModal(false);
        setWorkoutToCancel(null);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to cancel signup');
      }
    } catch (error) {
      console.error('Error canceling signup:', error);
      alert('Failed to cancel signup');
    }
  };

  const handleCancelCancel = () => {
    setShowCancelModal(false);
    setWorkoutToCancel(null);
  };

  // Check if user was promoted from waitlist after data refresh
  const checkForWaitlistPromotion = (workoutId) => {
            const wasOnWaitlist = workoutWaitlists[workoutId]?.some(w => w.user_id === currentUser.id);
        const isNowSignedUp = workoutSignups[workoutId]?.some(s => s.user_id === currentUser.id);
    
    if (wasOnWaitlist && isNowSignedUp) {
      // User was promoted from waitlist!
      const workout = workoutPosts.find(w => w.id === workoutId);
      setPromotedWorkout(workout);
      setShowPromotionMessage(true);
      
      // Auto-hide after 10 seconds
      setTimeout(() => {
        setShowPromotionMessage(false);
        setPromotedWorkout(null);
      }, 10000);
    }
  };

  const handleSubmitWorkout = async (e) => {
    e.preventDefault();
    if (!workoutForm.title.trim() || !workoutForm.date || !workoutForm.time || !workoutForm.content.trim()) return;

    // Check if the selected date is in the future
    const selectedDate = new Date(workoutForm.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
    
    if (selectedDate <= today) {
      alert('Please select a future date for your workout.');
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/forum/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: workoutForm.title.trim(),
          workoutType: workoutForm.type,
          workoutDate: workoutForm.date,
          workoutTime: workoutForm.time,
          content: workoutForm.content.trim(),
          capacity: workoutForm.capacity ? parseInt(workoutForm.capacity) : null,
          type: 'workout'
        })
      });

      if (response.ok) {
        const newPostData = await response.json();
        console.log('🔍 New workout data received:', newPostData);
        
        // Check if the response has the expected structure
        if (newPostData.post) {
          setWorkoutPosts([newPostData.post, ...workoutPosts]);
          console.log('✅ Workout added to state');
        } else if (newPostData.id) {
          // If the response is the post directly
          setWorkoutPosts([newPostData, ...workoutPosts]);
          console.log('✅ Workout added to state (direct response)');
        } else {
          console.error('❌ Unexpected response structure:', newPostData);
          // Fallback: reload all posts
          console.log('🔄 Reloading all posts as fallback...');
          loadForumPosts();
        }
        
        setWorkoutForm({
          title: '',
          type: 'spin',
          date: '',
          time: '',
          content: '',
          capacity: ''
        });
        setShowWorkoutForm(false);
      } else {
        console.error('Failed to create workout post');
      }
    } catch (error) {
        console.error('Error creating workout post:', error);
    }
  };

  const handleSubmitEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.title.trim() || !eventForm.date || !eventForm.content.trim()) return;

    // Check if the selected date is in the future
    const selectedDate = new Date(eventForm.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
    
    if (selectedDate <= today) {
      alert('Please select a future date for your event.');
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/forum/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: eventForm.title.trim(),
          eventDate: eventForm.date,
          content: eventForm.content.trim(),
          type: 'event'
        })
      });

      if (response.ok) {
        const newPostData = await response.json();
        setEventPosts([newPostData.post, ...eventPosts]);
        setEventForm({
          title: '',
          date: '',
          content: ''
        });
        setShowEventForm(false);
      } else {
        console.error('Failed to create event post');
      }
    } catch (error) {
      console.error('Error creating event post:', error);
    }
  };

  const handleLike = async (postId) => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/forum/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Reload posts to get updated like count
        loadForumPosts();
      } else {
        console.error('Failed to like post');
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleDeleteWorkout = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this workout post?')) {
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/forum/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        loadForumPosts();
      } else {
        console.error('Failed to delete workout post');
      }
    } catch (error) {
      console.error('Error deleting workout post:', error);
    }
  };

  const handleDeleteEvent = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this event post?')) {
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/forum/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        loadForumPosts();
      } else {
        console.error('Failed to delete event post');
      }
    } catch (error) {
      console.error('Error deleting event post:', error);
    }
  };



  // Date helpers (treat YYYY-MM-DD as UTC to avoid TZ shifting)
  const parseDateOnlyUTC = (dateStr) => {
    if (!dateStr) return null;
    const base = (typeof dateStr === 'string') ? dateStr.split('T')[0] : dateStr;
    const parts = base.split('-');
    if (parts.length !== 3) return new Date(dateStr);
    const [y, m, d] = parts.map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };

  const formatDateOnlyUTC = (dateStr) => {
    const d = parseDateOnlyUTC(dateStr);
    if (!d || isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { timeZone: 'UTC' });
  };

  // Helpers for date filtering
  const isPast = (dateStr) => {
    try {
      if (!dateStr) return false;
      const d = parseDateOnlyUTC(dateStr);
      if (!d || isNaN(d.getTime())) return false;
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      return d < today;
    } catch (_) {
      return false;
    }
  };

  // Filter workouts based on selected filters (time + type + sport)
  const getFilteredWorkouts = () => {
    // Use all loaded workouts for filtering
    // First filter by sport preference
    const bySport = allLoadedWorkouts.filter(post => {
      return isWorkoutTypeAllowed(post.workout_type);
    });

    // Then filter by time
    const byTime = bySport.filter(post => {
      const past = isPast(post.workout_date);
      return timeFilter === 'past' ? past : !past;
    });

    // Sort by actual workout_date, not created_at
    byTime.sort((a, b) => {
      const da = a && a.workout_date ? parseDateOnlyUTC(a.workout_date) : new Date(0);
      const db = b && b.workout_date ? parseDateOnlyUTC(b.workout_date) : new Date(0);
      return timeFilter === 'past' ? db - da : da - db; // past: newest first, upcoming: soonest first
    });

    if (workoutFilter === 'all') return byTime;

    return byTime.filter(post => {
      switch (workoutFilter) {
        case 'bike':
          return post.workout_type === 'spin' || post.workout_type === 'outdoor-ride' || post.workout_type === 'brick';
        case 'swim':
          return post.workout_type === 'swim';
        case 'run':
          return post.workout_type === 'run';
        default:
          return true;
      }
    });
  };

  // Get paginated workouts for past workouts (4 per page)
  const getPaginatedWorkouts = () => {
    const filtered = getFilteredWorkouts();
    if (timeFilter === 'upcoming') {
      // Upcoming workouts: show all (no pagination)
      return filtered;
    }
    // Past workouts: paginate
    const itemsPerPage = 4;
    const startIndex = (pastPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  // Calculate pagination info for past workouts
  const getPaginationInfo = () => {
    if (timeFilter === 'upcoming') {
      return null; // No pagination for upcoming
    }
    const filtered = getFilteredWorkouts();
    const itemsPerPage = 4;
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    return {
      currentPage: pastPage,
      totalPages: totalPages || 1,
      totalPosts: filtered.length,
      hasMore: pastPage < totalPages
    };
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!currentUser) {
    return null;
  }

  // Gate for pending users: show message instead of forum content
  if (!isMember(currentUser) && !isCoach(currentUser) && !isExec(currentUser)) {
    return (
      <div className="forum-container">
        <div className="container">
          <h1 className="section-title">Team Forum</h1>
          <div className="notice-card" style={{
            background: '#fff8e1',
            border: '1px solid #facc15',
            color: '#92400e',
            padding: '16px',
            borderRadius: '8px',
            lineHeight: 1.6
          }}>
            <p style={{margin: 0}}>
              You don't have access to the forum yet. Please email <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a> your membership receipt and we will confirm your registration! You will have to log out and then log back in to see this page.
            </p>
            <p style={{margin: '12px 0 0 0', fontSize: '14px', opacity: 0.9}}>
              <strong>Note:</strong> If you were a member on our old website, you'll be automatically approved as a member once you sign up. You will get an email once you get access!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="forum-container">
      <div className="container">
        <h1 className="section-title">Team Forum</h1>
        <p className="section-subtitle">Connect with your teammates and discuss training, races, and more!</p>
        
        {/* Forum Tabs */}
        <div className="forum-tabs">
          <button 
            className={`tab-button ${activeTab === 'workouts' ? 'active' : ''}`}
            onClick={() => setActiveTab('workouts')}
          >
            🏃‍♂️ Workouts
          </button>
          <button 
            className={`tab-button ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            🎉 Events
          </button>
        </div>

        {/* Workouts Section */}
        {activeTab === 'workouts' && (
          <div className="workouts-section">
            <div className="section-header">
              <h2>Workout Posts</h2>
              {(isExec(currentUser) || isCoach(currentUser)) && (
                <button 
                  className="new-post-btn"
                  onClick={() => setShowWorkoutForm(true)}
                >
                  + New Workout
                </button>
              )}
            </div>

            {/* Time Filters (row 1) */}
            <div className="workout-filters" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  className={`filter-btn ${timeFilter === 'upcoming' ? 'active' : ''}`}
                  onClick={() => { setTimeFilter('upcoming'); setPastPage(1); }}
                >
                  ⏳ Upcoming
                </button>
                <button 
                  className={`filter-btn ${timeFilter === 'past' ? 'active' : ''}`}
                  onClick={() => { setTimeFilter('past'); setPastPage(1); }}
                >
                  🗂 Past
                </button>
              </div>

              {(() => {
                const pagination = getPaginationInfo();
                if (!pagination) return null;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalPosts} workouts)</span>
                    <button 
                      className="filter-btn"
                      onClick={() => setPastPage(p => Math.max(1, p - 1))}
                      disabled={pagination.currentPage <= 1}
                    >
                      Previous
                    </button>
                    <button 
                      className="filter-btn"
                      onClick={() => setPastPage(p => Math.min(pagination.totalPages, p + 1))}
                      disabled={pagination.currentPage >= pagination.totalPages}
                    >
                      Next
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Type Filters (row 2) */}
            <div className="workout-filters">
              <button 
                className={`filter-btn ${workoutFilter === 'all' ? 'active' : ''}`}
                onClick={() => setWorkoutFilter('all')}
              >
                🏁 All Types
              </button>
              <button 
                className={`filter-btn ${workoutFilter === 'bike' ? 'active' : ''}`}
                onClick={() => setWorkoutFilter('bike')}
              >
                🚴‍♂️ Bike (Indoor/Outdoor/Brick)
              </button>
              <button 
                className={`filter-btn ${workoutFilter === 'swim' ? 'active' : ''}`}
                onClick={() => setWorkoutFilter('swim')}
              >
                🏊‍♂️ Swim
              </button>
              <button 
                className={`filter-btn ${workoutFilter === 'run' ? 'active' : ''}`}
                onClick={() => setWorkoutFilter('run')}
              >
                🏃‍♀️ Run
              </button>
            </div>

            {(() => {
              const paginatedWorkouts = getPaginatedWorkouts();
              const filteredCount = getFilteredWorkouts().length;
              
              if (filteredCount === 0) {
                return (
                  <p className="no-posts">
                    {workoutsLoading 
                      ? 'Loading workouts...'
                      : (workoutPosts.length === 0 
                          ? 'No workout posts yet.' 
                          : `No ${workoutFilter === 'all' ? '' : workoutFilter} workouts found.`)}
                  </p>
                );
              }
              
              return (
                <div className="posts-list">
                  {paginatedWorkouts.filter(post => post && post.id).map(post => (
                  <div key={post.id} className="post-card workout-post" onClick={() => window.location.href = `/workout/${post.id}`}>
                    <div className="post-header">
                      {post.title ? (
                        <div className="workout-title">
                          <h2>
                            {post.title}
                          </h2>
                        </div>
                      ) : (
                        <div className="workout-title">
                          <h2>Untitled Workout</h2>
                        </div>
                      )}
                      
                      {/* Edit and Delete buttons for workout author, executives, and administrators */}
                      {(currentUser.id === post.user_id || currentUser.role === 'exec' || currentUser.role === 'administrator') && (
                        <div className="workout-actions-admin">
                          <button 
                            className="edit-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(post);
                            }}
                            disabled={editingWorkout === post.id}
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            className="delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWorkout(post.id);
                            }}
                            disabled={editingWorkout === post.id}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="workout-author">
                      <div className="author-info">
                        {(() => {
                          const { normalizeProfileImageUrl } = require('../utils/imageUtils');
                          const url = normalizeProfileImageUrl(post.authorProfilePictureUrl);
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
                        {/* single image handled above; no extra fallback */}
                        <span className="author-name">Posted by {post.author_name}</span>
                      </div>
                    </div>
                    
                    {editingWorkout === post.id ? (
                      <div className="workout-edit-form">
                        <div className="form-group">
                          <label htmlFor={`edit-title-${post.id}`}>Title:</label>
                          <input
                            id={`edit-title-${post.id}`}
                            type="text"
                            value={editForm.title}
                            onChange={(e) => updateField('title', e.target.value)}
                            className="form-input"
                            placeholder="Enter workout title..."
                          />
                        </div>
                        
                        <div className="form-row">
                          <div className="form-group">
                            <label htmlFor={`edit-type-${post.id}`}>Workout Type:</label>
                            <input
                              id={`edit-type-${post.id}`}
                              type="text"
                                                          value={editForm.workoutType}
                            onChange={(e) => updateField('workoutType', e.target.value)}
                              className="form-input"
                              placeholder="Enter workout type..."
                            />
                          </div>
                          
                          <div className="form-group">
                            <label htmlFor={`edit-capacity-${post.id}`}>Capacity:</label>
                            <input
                              id={`edit-capacity-${post.id}`}
                              type="number"
                              min="1"
                                                          value={editForm.capacity}
                            onChange={(e) => updateField('capacity', e.target.value)}
                              className="form-input"
                              placeholder="Enter capacity..."
                            />
                          </div>
                        </div>
                        
                        <div className="form-row">
                          <div className="form-group">
                            <label htmlFor={`edit-date-${post.id}`}>Date:</label>
                            <input
                              id={`edit-date-${post.id}`}
                              type="date"
                                                          value={editForm.workoutDate}
                            onChange={(e) => updateField('workoutDate', e.target.value)}
                              className="form-input"
                            />
                          </div>
                          
                          <div className="form-group">
                            <label htmlFor={`edit-time-${post.id}`}>Time:</label>
                            <input
                              id={`edit-time-${post.id}`}
                              type="time"
                                                          value={editForm.workoutTime}
                            onChange={(e) => updateField('workoutTime', e.target.value)}
                              className="form-input"
                            />
                          </div>
                        </div>
                        
                        <div className="form-group">
                          <label htmlFor={`edit-content-${post.id}`}>Description:</label>
                          <textarea
                            id={`edit-content-${post.id}`}
                            value={editForm.content}
                            onChange={(e) => updateField('content', e.target.value)}
                            className="form-textarea"
                            rows="3"
                            placeholder="Enter workout description..."
                          />
                        </div>
                        
                        <div className="edit-actions">
                          <button 
                            className="btn btn-primary" 
                            onClick={() => saveWorkout(post.id, loadForumPosts)}
                            disabled={saving}
                          >
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            onClick={cancelEdit}
                            disabled={saving}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {post.workout_type && (
                          <div className="workout-meta">
                            <span className="workout-type-badge">{post.workout_type}</span>
                            {post.workout_date && (
                              <span className="workout-date">
                                📅 {formatDateOnlyUTC(post.workout_date)}
                                {post.workout_time && (
                                  <span className="workout-time"> • 🕐 {post.workout_time}</span>
                                )}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Content omitted in list view for performance; open detail to view full description */}
                      </>
                    )}

                    {/* Sign-up button positioned at bottom right */}
                    <div className="workout-signup-section">
                      <div className="button-group">
                        <button 
                          className="signup-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/workout/${post.id}`;
                          }}
                        >
                          View Details
                        </button>
                      </div>
                      <div className="signup-count">
                        <div className="signup-main">
                          {post.capacity 
                            ? `${(post.signup_count ?? 0)}/${post.capacity} signed up`
                            : `${(post.signup_count ?? 0)} signed up`
                          }
                        </div>
                        {post.capacity && (
                          <div className="signup-details">
                            <span className={`capacity-status ${(post.signup_count ?? 0) >= post.capacity ? 'full' : 'available'}`}>
                              {(post.signup_count ?? 0) >= post.capacity ? 'Full' : 'Available'}
                            </span>
                            {(post.waitlist_count ?? 0) > 0 && (
                              <span className="waitlist-count">
                                {post.waitlist_count} on waitlist
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Events Section */}
        {activeTab === 'events' && (
          <div className="events-section">
            <div className="section-header">
              <h2>Event Posts</h2>
              {isExec(currentUser) && (
                <button 
                  className="new-post-btn"
                  onClick={() => setShowEventForm(true)}
                >
                  + New Event
                </button>
              )}
            </div>

            {eventPosts.length === 0 ? (
              <p className="no-posts">{eventsLoading ? 'Events loading...' : 'No event posts yet.'}</p>
            ) : (
              <div className="posts-list">
                {eventPosts.map(post => (
                  <div key={post.id} className="post-card event-post" onClick={() => window.location.href = `/event/${post.id}`}>
                    <div className="post-header">
                      {editingEvent === post.id ? (
                        <div className="event-edit-form">
                          <div className="form-group">
                            <label htmlFor={`edit-event-title-${post.id}`}>Title:</label>
                            <input
                              id={`edit-event-title-${post.id}`}
                              type="text"
                              value={eventEditForm.title}
                              onChange={(e) => updateEventField('title', e.target.value)}
                              className="form-input"
                              placeholder="Enter event title..."
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor={`edit-event-date-${post.id}`}>Date:</label>
                            <input
                              id={`edit-event-date-${post.id}`}
                              type="date"
                              value={eventEditForm.date}
                              onChange={(e) => updateEventField('date', e.target.value)}
                              className="form-input"
                            />
                          </div>

                          <div className="form-group">
                            <label htmlFor={`edit-event-content-${post.id}`}>Details:</label>
                            <textarea
                              id={`edit-event-content-${post.id}`}
                              value={eventEditForm.content}
                              onChange={(e) => updateEventField('content', e.target.value)}
                              className="form-textarea"
                              rows="3"
                              placeholder="Enter event details..."
                            />
                          </div>

                          <div className="edit-actions">
                            <button 
                              className="btn btn-primary" 
                              onClick={(e) => { e.stopPropagation(); saveEvent(post.id); }}
                              disabled={savingEvent}
                            >
                              {savingEvent ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              onClick={(e) => { e.stopPropagation(); cancelEventEdit(); }}
                              disabled={savingEvent}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {post.title && (
                            <div className="event-title">
                              <h3>
                                {post.title}
                              </h3>
                            </div>
                          )}

                          {/* Edit/Delete for author, exec, admin */}
                          {(currentUser.id === post.user_id || currentUser.role === 'exec' || currentUser.role === 'administrator') && (
                            <div className="workout-actions-admin">
                              <button 
                                className="edit-btn"
                                onClick={(e) => { e.stopPropagation(); startEventEdit(post); }}
                                disabled={editingEvent === post.id}
                              >
                                ✏️ Edit
                              </button>
                              <button 
                                className="delete-btn"
                                onClick={(e) => { e.stopPropagation(); handleDeleteEvent(post.id); }}
                                disabled={editingEvent === post.id}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    
                    <div className="event-author">
                      <div className="author-info">
                        {(() => {
                          const { normalizeProfileImageUrl } = require('../utils/imageUtils');
                          const url = normalizeProfileImageUrl(post.authorProfilePictureUrl);
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
                        <span className="author-name">Posted by {post.author_name}</span>
                      </div>
                    </div>
                    
                    {post.event_date && (
                      <div className="event-meta">
                        <span className="event-date">
                          {(() => {
                            try {
                              const base = String(post.event_date).split('T')[0];
                              const [y, m, d] = base.split('-').map(Number);
                              const dt = new Date(Date.UTC(y, m - 1, d));
                              return `📅 ${dt.toLocaleDateString(undefined, { timeZone: 'UTC' })}`;
                            } catch {
                              return `📅 ${post.event_date}`;
                            }
                          })()}
                        </span>
                      </div>
                    )}
                    
                    <div className="post-footer">
                      <div className="rsvp-buttons">
                        <button 
                          className="rsvp-btn going"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/event/${post.id}`;
                          }}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Waitlist Promotion Success Message */}
        {showPromotionMessage && promotedWorkout && (
          <div className="promotion-message">
            <div className="promotion-content">
              <h3>🎉 Congratulations!</h3>
              <p>You've been promoted from the waitlist for <strong>{promotedWorkout.title}</strong>!</p>
              <p>Check your email for details. You're now officially signed up for this workout.</p>
              <button 
                className="promotion-close-btn"
                onClick={() => setShowPromotionMessage(false)}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Cancel Confirmation Modal */}
        {showCancelModal && (
          <div className="modal-overlay">
            <div className="modal cancel-modal">
              <h2>Cancel Workout Signup</h2>
              <div className="cancel-warning">
                <p>⚠️ <strong>Important:</strong> If you cancel less than 12 hours in advance, it will count as an absence.</p>
                <p>Your absences are recorded and once you have three, you will be suspended from signing up for a week.</p>
                <p>This is to keep it fair for all members!</p>
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={handleCancelCancel}>
                  Keep Booking
                </button>
                <button className="btn-danger" onClick={handleCancelConfirm}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workout Creation Modal */}
        {showWorkoutForm && (
          <div className="modal-overlay">
            <div className="modal">
              <h2>Create New Workout Post</h2>
              <form onSubmit={handleSubmitWorkout}>
                <div className="form-group">
                  <label>Workout Title:</label>
                  <input
                    type="text"
                    value={workoutForm.title}
                    onChange={(e) => setWorkoutForm({...workoutForm, title: e.target.value})}
                    placeholder="e.g., Tuesday Morning Swim, Weekend Long Run"
                    maxLength="100"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Workout Type:</label>
                  <select
                    value={workoutForm.type}
                    onChange={(e) => setWorkoutForm({...workoutForm, type: e.target.value})}
                    required
                  >
                    {getAllowedWorkoutTypes().map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Workout Date:</label>
                  <input
                    type="date"
                    value={workoutForm.date}
                    onChange={(e) => setWorkoutForm({...workoutForm, date: e.target.value})}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Workout Time:</label>
                  <input
                    type="time"
                    value={workoutForm.time}
                    onChange={(e) => setWorkoutForm({...workoutForm, time: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Additional Details:</label>
                  <textarea
                    value={workoutForm.content}
                    onChange={(e) => setWorkoutForm({...workoutForm, content: e.target.value})}
                    placeholder="Describe the workout, time, location, requirements, what to bring..."
                    rows="4"
                    maxLength="500"
                    required
                  />
                  <small className="char-count">{workoutForm.content.length}/500</small>
                </div>

                <div className="form-group">
                  <label>Capacity (Optional):</label>
                  <input
                    type="number"
                    value={workoutForm.capacity}
                    onChange={(e) => setWorkoutForm({...workoutForm, capacity: e.target.value})}
                    placeholder="Leave empty for unlimited spots"
                    min="1"
                    max="100"
                  />
                  <small>Maximum number of people who can sign up. Leave empty for unlimited spots.</small>
                </div>

                <div className="modal-actions">
                  <button type="submit" className="btn btn-primary">Post Workout</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowWorkoutForm(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Event Creation Modal */}
        {showEventForm && (
          <div className="modal-overlay">
            <div className="modal">
              <h2>Create New Event Post</h2>
              <form onSubmit={handleSubmitEvent}>
                <div className="form-group">
                  <label>Event Title:</label>
                  <input
                    type="text"
                    value={eventForm.title}
                    onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                    placeholder="e.g., Club Social Night, Race Watch Party"
                    maxLength="100"
                    required
                  />
                </div>

                                <div className="form-group">
                  <label>Event Date:</label>
                  <input
                    type="date"
                    value={eventForm.date}
                    onChange={(e) => setEventForm({...eventForm, date: e.target.value})}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Event Details:</label>
                  <textarea
                    value={eventForm.content}
                    onChange={(e) => setEventForm({...eventForm, content: e.target.value})}
                    placeholder="Describe the event, time, location, what to bring, RSVP details..."
                    rows="4"
                    maxLength="500"
                    required
                  />
                  <small className="char-count">{eventForm.content.length}/500</small>
                </div>

                <div className="modal-actions">
                  <button type="submit" className="btn btn-primary">Post Event</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowEventForm(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Forum;
