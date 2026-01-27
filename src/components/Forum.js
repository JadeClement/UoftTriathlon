import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkoutEdit } from '../hooks/useWorkoutEdit';
import { useForumPosts, useOnlineStatus } from '../hooks/useOfflineData';
import { showSuccess, showError, showWarning } from './SimpleNotification';
import ConfirmModal from './ConfirmModal';
import PullToRefresh from './PullToRefresh';
import { PostSkeleton } from './LoadingSkeleton';
import { hapticImpact } from '../utils/haptics';
import './Forum.css';

const Forum = () => {
  const { currentUser, isMember, isExec, isCoach } = useAuth();
  const cachedUser = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('triathlonUser');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('🧭 Forum: failed to parse cached user', e);
      return null;
    }
  }, []);
  const effectiveUser = currentUser || cachedUser;
  const [activeTab, setActiveTab] = useState('workouts');
  const [workoutPosts, setWorkoutPosts] = useState([]);
  const [allLoadedWorkouts, setAllLoadedWorkouts] = useState([]); // Store all loaded workouts from backend
  const [workoutsFullyLoaded, setWorkoutsFullyLoaded] = useState(false); // Track if we've loaded all workouts
  const [lastWorkoutFilter, setLastWorkoutFilter] = useState('all'); // Track last filter to detect changes
  const [loading, setLoading] = useState(true);
  
  // Offline data hooks
  const isOnline = useOnlineStatus();
  const { 
    posts: eventPostsFromCache, 
    loading: eventsLoadingFromCache, 
    fromCache: eventsFromCache,
    isOffline: eventsOffline,
    refresh: refreshEvents
  } = useForumPosts({ type: 'event', enabled: isMember(effectiveUser) });
  
  // Use cached events if available, otherwise use state
  const [eventPosts, setEventPosts] = useState([]);
  const [showWorkoutForm, setShowWorkoutForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [workoutFilter, setWorkoutFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('upcoming'); // 'upcoming' | 'past'
  const [pastPage, setPastPage] = useState(1);
  const [workoutForm, setWorkoutForm] = useState({
    title: '',
    type: 'swim',
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
  // Ref to ensure the workout date input never has a min attribute (Safari/iOS can persist it)
  const workoutDateInputRef = useRef(null);

  useEffect(() => {
    if (workoutDateInputRef.current) {
      try {
        workoutDateInputRef.current.removeAttribute('min');
      } catch (_) {}
    }
  }, [showWorkoutForm]);

  // Lock body scroll when workout form modal is open
  useEffect(() => {
    if (showWorkoutForm) {
      // Save current scroll position
      const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      
      // Lock body scroll - use a simpler approach that doesn't interfere with modal positioning
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const originalWidth = document.body.style.width;
      
      // Prevent scrolling
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.left = '0';
      document.body.style.right = '0';
      
      return () => {
        // Restore original styles
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;
        document.body.style.left = '';
        document.body.style.right = '';
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [showWorkoutForm]);
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
  const [termExpired, setTermExpired] = useState(false);
  const [termExpiredMessage, setTermExpiredMessage] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteWorkoutConfirm, setDeleteWorkoutConfirm] = useState({ isOpen: false, postId: null });
  const [deleteEventConfirm, setDeleteEventConfirm] = useState({ isOpen: false, postId: null });
  
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

  // Load more workouts when navigating to later pages if needed
  useEffect(() => {
    if (timeFilter === 'past' && isMember(currentUser) && pastPage > 1) {
      const filtered = getFilteredWorkouts();
      const itemsPerPage = 5;
      const neededForCurrentPage = pastPage * itemsPerPage;
      
      // If we don't have enough workouts for the current page, load more
      if (filtered.length < neededForCurrentPage && !workoutsFullyLoaded) {
        loadForumPosts();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pastPage]);
  
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
        case 'swim_only':
          return workoutType === 'swim';
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
      case 'swim_only':
        return [
          { value: 'swim', label: 'Swim' },
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

  // Ensure selected workout type stays valid for the user's sport
  useEffect(() => {
    const options = getAllowedWorkoutTypes();
    if (!options || options.length === 0) return;
    const valid = options.some(o => o.value === workoutForm.type);
    if (!valid) {
      setWorkoutForm(form => ({ ...form, type: options[0].value }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.sport]);
  
  const { 
    editingWorkout, 
    editForm, 
    saving, 
    startEdit, 
    cancelEdit, 
    updateField, 
    saveWorkout 
  } = useWorkoutEdit(API_BASE_URL);

  // ESLint: loadForumPosts is stable and we only want to rerun when effectiveUser or membership changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    console.log('🧭 Forum mount/useEffect: user', effectiveUser?.id, 'role', effectiveUser?.role);
    if (!effectiveUser) {
      console.log('🧭 Forum: no effectiveUser, showing sign-in notice');
      // No user: stop loading so we can show the gate message instead of redirecting
      setLoading(false);
      return;
    }
    
    const member = isMember(effectiveUser);
    console.log('🧭 Forum: user role check', { member, role: effectiveUser?.role });
    // If user is at least member, load posts. If pending, we'll render a gate message.
    if (member) {
      loadForumPosts();
    } else {
      // Ensure we don't stay stuck on loading for pending users
      setLoading(false);
    }
  }, [effectiveUser, isMember]);

  // Listen for profile updates to refresh profile pictures
  // ESLint: loadForumPosts is stable; this effect is intentionally only mounted once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Sync event posts from cache hook to state (must be before any early returns)
  useEffect(() => {
    if (eventPostsFromCache && eventPostsFromCache.length > 0) {
      setEventPosts(eventPostsFromCache);
    }
  }, [eventPostsFromCache]);

  const loadForumPosts = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      // Reset term expired state when loading
      setTermExpired(false);
      setTermExpiredMessage('');

      console.log('🔄 loadForumPosts called:', { timeFilter, workoutFilter, pastPage });

      // Load workout posts - load in batches until we have enough filtered results
      setWorkoutsLoading(true);
      
      // Determine if we need to reset (when filters change) or continue loading (when navigating pages)
      const filterChanged = workoutFilter !== lastWorkoutFilter;
      const shouldReset = timeFilter === 'past' && (allLoadedWorkouts.length === 0 || filterChanged);
      
      console.log('🔄 Loading state:', { filterChanged, shouldReset, allLoadedWorkoutsCount: allLoadedWorkouts.length });
      
      if (filterChanged) {
        setLastWorkoutFilter(workoutFilter);
        setAllLoadedWorkouts([]);
        setWorkoutsFullyLoaded(false);
      }
      
      let allWorkouts = shouldReset ? [] : [...allLoadedWorkouts]; // Keep existing workouts if continuing
      let page = shouldReset ? 1 : Math.floor(allLoadedWorkouts.length / 20) + 1; // Continue from where we left off
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

        if (workoutResponse.status === 403) {
          const errorData = await workoutResponse.json();
          if (errorData.error === 'term_expired') {
            setTermExpired(true);
            setTermExpiredMessage(errorData.message || 'Sorry, your term has expired. To regain access please purchase a membership for the next term. If you have questions please email info@uoft-tri.club.');
            return;
          }
        }

        if (workoutResponse.ok) {
          const workoutData = await workoutResponse.json();
          const posts = workoutData.posts || [];
          const validPosts = posts.filter(post => post && post.id && typeof post === 'object');
          allWorkouts = validPosts;
        }
      } else {
        // For past workouts: Simple and reliable approach
        // 1. Load batches from backend (with backend workout_type filter if available)
        // 2. Accumulate in allWorkouts
        // 3. After each batch, check getFilteredWorkouts() to see if we have enough
        // 4. Keep loading until we have enough for current page OR run out of data
        
        console.log('📋 Loading past workouts:', { shouldReset, page, pastPage, workoutFilter });
        
        const itemsPerPage = 5;
        const neededForCurrentPage = pastPage * itemsPerPage;
        const neededForNextPage = (pastPage + 1) * itemsPerPage;
        
        // Load batches until we have enough filtered workouts
        while (hasMore) {
          const qp = new URLSearchParams();
          qp.set('type', 'workout');
          qp.set('time', 'past');
          qp.set('page', String(page));
          qp.set('limit', String(limit));
          
          // Use backend filtering for workout_type (efficiency optimization)
          if (workoutFilter !== 'all') {
            qp.set('workout_type', workoutFilter);
          }
          
          const fetchUrl = `${API_BASE_URL}/forum/posts?${qp.toString()}`;
          console.log('🌐 Fetching:', fetchUrl);
          
          const workoutResponse = await fetch(fetchUrl, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (workoutResponse.status === 403) {
            const errorData = await workoutResponse.json();
            if (errorData.error === 'term_expired') {
              setTermExpired(true);
              setTermExpiredMessage(errorData.message || 'Sorry, your term has expired. To regain access please purchase a membership for the next term. If you have questions please email info@uoft-tri.club.');
              return;
            }
          }

          if (!workoutResponse.ok) {
            console.error('❌ Fetch failed:', workoutResponse.status);
            break;
          }
          
          const workoutData = await workoutResponse.json();
          const posts = workoutData.posts || [];
          const validPosts = posts.filter(post => post && post.id && typeof post === 'object');
          
          console.log('📦 Backend returned:', { totalPosts: posts.length, validPosts: validPosts.length });
          
          if (validPosts.length === 0) {
            hasMore = false;
            break;
          }
          
          // Add new workouts to collection
          allWorkouts = [...allWorkouts, ...validPosts];
          
          console.log('📊 Total loaded so far:', allWorkouts.length);
          
          // Temporarily update state so getFilteredWorkouts() can use it
          // (We'll set it properly at the end)
          const tempAllLoaded = allWorkouts;
          
          // Use the EXACT same filtering logic as getFilteredWorkouts() to ensure accuracy
          // Step 1: Filter by sport (matches getFilteredWorkouts line 1113-1115)
          const bySport = tempAllLoaded.filter(post => {
            return isWorkoutTypeAllowed(post.workout_type);
          });
          
          // Step 2: Filter by time (matches getFilteredWorkouts line 1118-1121)
          const byTime = bySport.filter(post => {
            const past = isPast(post.workout_date);
            return timeFilter === 'past' ? past : !past;
          });
          
          // Step 3: Apply workout type filter (matches getFilteredWorkouts line 1115-1128)
          let tempFiltered = byTime;
          if (workoutFilter !== 'all') {
            tempFiltered = byTime.filter(post => {
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
          }
          
          const filteredCount = tempFiltered.length;
          
          // Check if backend has more pages
          const pagination = workoutData.pagination;
          hasMore = pagination?.hasMore || false;
          
          // Decision: Do we have enough?
          // CRITICAL: For page 1, we MUST have at least 5 workouts before stopping
          // For page 2+, we need at least (pastPage) * 5
          
          console.log('🔍 Loading check:', {
            pastPage,
            filteredCount,
            neededForCurrentPage,
            neededForNextPage,
            hasMore,
            allWorkoutsCount: allWorkouts.length
          });
          
          // Priority 1: If on page 1, we MUST keep loading until we have at least 5
          if (pastPage === 1 && filteredCount < itemsPerPage) {
            if (!hasMore) {
              // No more data, have to stop with what we have
              console.log('⚠️ Page 1: Only', filteredCount, 'workouts but no more data available');
              break;
            }
            // Continue loading to try to get at least 5
            console.log('🔄 Page 1: Only', filteredCount, 'workouts, loading more...');
            page++;
            continue;
          }
          
          // Priority 2: Stop if we have enough for current + next page (ideal)
          if (filteredCount >= neededForNextPage) {
            console.log('✅ Have enough for current + next page:', filteredCount);
            break;
          }
          
          // Priority 3: If we have enough for current page, we can stop
          if (filteredCount >= neededForCurrentPage) {
            console.log('✅ Have enough for current page:', filteredCount);
            break;
          }
          
          // If no more data from backend, stop even if we don't have enough
          if (!hasMore) {
            console.log('⚠️ No more data available, stopping with', filteredCount, 'workouts');
            break;
          }
          
          // Load next batch
          page++;
          
          // Safety limit to prevent infinite loops
          if (page > 100) {
            console.warn('Hit safety limit of 100 pages while loading workouts');
            break;
          }
        }
      }
      
      setAllLoadedWorkouts(allWorkouts);
      setWorkoutPosts(allWorkouts);
      setWorkoutsFullyLoaded(!hasMore || timeFilter === 'upcoming');
        
      // Do not load per-workout signups/waitlists here; fetch on demand in detail view

      // Event posts are now loaded via useForumPosts hook (offline-first)
      // Only manually refresh if needed
      if (activeTab === 'events' && isOnline) {
        refreshEvents();
      }
    } catch (error) {
      console.error('Error loading forum posts:', error);
    } finally {
      setLoading(false);
      setWorkoutsLoading(false);
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

  // eslint-disable-next-line no-unused-vars
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
      showError(error.message || 'Error updating event');
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleWorkoutSignUp = async (workoutId) => {
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
        // eslint-disable-next-line no-unused-vars
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

  // eslint-disable-next-line no-unused-vars
  const isWorkoutFull = (workoutId) => {
    if (!workoutId) return false;
    const workout = workoutPosts.find(w => w && w.id === workoutId);
    if (!workout || !workout.capacity) return false;
    const currentSignups = workoutSignups[workoutId]?.length || 0;
    return currentSignups >= workout.capacity;
  };

  // eslint-disable-next-line no-unused-vars
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

  // eslint-disable-next-line no-unused-vars
  const isUserOnWaitlist = (workoutId) => {
    if (!workoutId) return false;
    return workoutWaitlists[workoutId]?.some(waitlist => waitlist && waitlist.user_id === currentUser.id) || false;
  };

  // Returns 1-based position or null if not on waitlist
  // eslint-disable-next-line no-unused-vars
  const getWaitlistPosition = (workoutId) => {
    if (!workoutId) return null;
    const list = workoutWaitlists[workoutId] || [];
    const idx = list.findIndex(w => w && w.user_id === currentUser.id);
    return idx === -1 ? null : idx + 1;
  };

  // eslint-disable-next-line no-unused-vars
  const formatOrdinal = (n) => {
    if (n == null) return '';
    const s = ["th","st","nd","rd"], v = n % 100;
    return n + (s[(v-20)%10] || s[v] || s[0]);
  };

  // Event RSVP functions
  // eslint-disable-next-line no-unused-vars
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
        showError(error.error || 'Error updating RSVP');
      }
    } catch (error) {
      console.error('Error updating event RSVP:', error);
      showError('Error updating RSVP');
    }
  };

  // eslint-disable-next-line no-unused-vars
  const getUserRsvpStatus = (eventId) => {
    if (!eventId) return null;
    const rsvps = eventRsvps[eventId] || [];
    const userRsvp = rsvps.find(rsvp => rsvp.user_id === currentUser.id);
    return userRsvp ? userRsvp.status : null;
  };

  // eslint-disable-next-line no-unused-vars
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
        showError(error.error || 'Failed to join waitlist');
      }
    } catch (error) {
      console.error('Error joining waitlist:', error);
      showError('Failed to join waitlist');
    }
  };

  // eslint-disable-next-line no-unused-vars
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
        showError(error.error || 'Failed to leave waitlist');
      }
    } catch (error) {
      console.error('Error leaving waitlist:', error);
      showError('Failed to leave waitlist');
    }
  };

  // eslint-disable-next-line no-unused-vars
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
        showError(error.error || 'Failed to cancel signup');
      }
    } catch (error) {
      console.error('Error canceling signup:', error);
      showError('Failed to cancel signup');
    }
  };

  const handleCancelCancel = () => {
    setShowCancelModal(false);
    setWorkoutToCancel(null);
  };

  // Check if user was promoted from waitlist after data refresh
  // eslint-disable-next-line no-unused-vars
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

    // Check if offline - forum posts require online connection
    if (!navigator.onLine) {
      showError("Whoops! You're offline right now. Please check your internet connection and try again when you're back online!");
      return;
    }

    // Allow both past and future dates for workouts (practices can be added retroactively)

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
        
        const defaultType = (getAllowedWorkoutTypes()[0]?.value) || 'swim';
        setWorkoutForm({
          title: '',
          type: defaultType,
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

    // Check if offline - forum posts require online connection
    if (!navigator.onLine) {
      showError("Whoops! You're offline right now. Please check your internet connection and try again when you're back online!");
      return;
    }

    // Check if the selected date is in the future
    const selectedDate = new Date(eventForm.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison
    
    if (selectedDate <= today) {
      showError('Please select a future date for your event.');
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
        // Refresh events from cache to sync
        refreshEvents();
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

  // eslint-disable-next-line no-unused-vars
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
    setDeleteWorkoutConfirm({ isOpen: true, postId: postId });
  };

  const confirmDeleteWorkout = async () => {
    const { postId } = deleteWorkoutConfirm;
    setDeleteWorkoutConfirm({ isOpen: false, postId: null });
    
    if (!postId) return;

    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        showError('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/forum/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        showSuccess('Workout post deleted successfully');
        loadForumPosts();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        if (response.status === 404) {
          showWarning('This workout post may have already been deleted. Refreshing...');
          loadForumPosts();
        } else if (response.status === 403) {
          showError('You are not authorized to delete this post.');
        } else {
          showError(errorData.error || 'Failed to delete workout post');
        }
      }
    } catch (error) {
      console.error('Error deleting workout post:', error);
      showError('Failed to delete workout post. Please try again.');
    }
  };

  const handleDeleteEvent = async (postId) => {
    setDeleteEventConfirm({ isOpen: true, postId: postId });
  };

  const confirmDeleteEvent = async () => {
    const { postId } = deleteEventConfirm;
    setDeleteEventConfirm({ isOpen: false, postId: null });
    
    if (!postId) return;

    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        showError('Authentication required. Please log in again.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/forum/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        showSuccess('Event post deleted successfully');
        loadForumPosts();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        if (response.status === 404) {
          showWarning('This event post may have already been deleted. Refreshing...');
          loadForumPosts();
        } else if (response.status === 403) {
          showError('You are not authorized to delete this post.');
        } else {
          showError(errorData.error || 'Failed to delete event post');
        }
      }
    } catch (error) {
      console.error('Error deleting event post:', error);
      showError('Failed to delete event post. Please try again.');
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
    let filtered = allLoadedWorkouts;

    // Only apply sport preference filtering when a specific workout type is selected
    // When "all" is selected, show all workout types regardless of sport preference
    if (workoutFilter !== 'all') {
      filtered = filtered.filter(post => {
        return isWorkoutTypeAllowed(post.workout_type);
      });
    }

    // Filter by workout type if not "all"
    if (workoutFilter !== 'all') {
      filtered = filtered.filter(post => {
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
    }

    // Then filter by time
    const byTime = filtered.filter(post => {
      const past = isPast(post.workout_date);
      return timeFilter === 'past' ? past : !past;
    });

    // Sort by actual workout_date, not created_at
    byTime.sort((a, b) => {
      const da = a && a.workout_date ? parseDateOnlyUTC(a.workout_date) : new Date(0);
      const db = b && b.workout_date ? parseDateOnlyUTC(b.workout_date) : new Date(0);
      return timeFilter === 'past' ? db - da : da - db; // past: newest first, upcoming: soonest first
    });

    return byTime;
  };

  // Get paginated workouts for past workouts (5 per page)
  const getPaginatedWorkouts = () => {
    const filtered = getFilteredWorkouts();
    if (timeFilter === 'upcoming') {
      // Upcoming workouts: show all (no pagination)
      return filtered;
    }
    // Past workouts: paginate
    const itemsPerPage = 5;
    const startIndex = (pastPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  // Calculate pagination info for past workouts and load more if needed
  const getPaginationInfo = () => {
    if (timeFilter === 'upcoming') {
      return null; // No pagination for upcoming
    }
    const filtered = getFilteredWorkouts();
    const itemsPerPage = 5;
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    
    // Note: Loading more workouts is handled by the useEffect on pastPage change
    
    return {
      currentPage: pastPage,
      totalPages: totalPages || 1,
      totalPosts: filtered.length,
      hasMore: pastPage < totalPages
    };
  };

  if (loading) {
    return (
      <div className="forum-container">
        <div className="container">
          <h1 className="section-title">Team Forum</h1>
          <div className="posts-list">
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (!effectiveUser) {
    console.log('🧭 Forum render: unauthenticated gate');
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
            lineHeight: 1.6,
            marginTop: '16px'
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

  // Gate for pending users: show message instead of forum content
  if (!isMember(effectiveUser) && !isCoach(effectiveUser) && !isExec(effectiveUser)) {
    console.log('🧭 Forum render: pending/non-member gate', { role: effectiveUser?.role });
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
            lineHeight: 1.6,
            marginTop: '16px'
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

  // Gate for expired terms: show message instead of forum content
  if (termExpired) {
    return (
      <div className="forum-container">
        <div className="container">
          <h1 className="section-title">Team Forum</h1>
          <div className="notice-card" style={{
            background: '#fee2e2',
            border: '1px solid #ef4444',
            color: '#991b1b',
            padding: '16px',
            borderRadius: '8px',
            lineHeight: 1.6
          }}>
            <p style={{margin: 0}}>
              {termExpiredMessage}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleRefresh = async () => {
    hapticImpact();
    if (activeTab === 'events') {
      await refreshEvents();
    } else {
      await loadForumPosts();
    }
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={!isOnline}>
      <div className="forum-container">
        <div className="container">
          <div style={{ marginBottom: '1rem' }}>
            <h1 className="section-title" style={{ marginBottom: '-1rem', marginTop: '0', lineHeight: '1', paddingBottom: '0', display: 'block' }}>Team Forum</h1>
            <p className="section-subtitle" style={{ marginTop: '2rem', marginBottom: '0', lineHeight: '1.2', paddingTop: '0', display: 'block' }}>Connect with your teammates and discuss training, races, and more!</p>
          </div>
          
          {/* Offline Indicator */}
          {!isOnline && (
            <div className="offline-indicator">
              <span className="offline-icon">📴</span>
              <span className="offline-text">You're offline. Showing cached data.</span>
            </div>
          )}
          
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {!isOnline && (
                  <span className="offline-badge" title="You're offline">
                    📴 Offline
                  </span>
                )}
                <button 
                  className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
                  onClick={() => setShowFilters(!showFilters)}
                  aria-label="Toggle filters"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="6" cy="5" r="1.5" fill="currentColor"/>
                    <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="14" cy="10" r="1.5" fill="currentColor"/>
                    <line x1="3" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="6" cy="15" r="1.5" fill="currentColor"/>
                  </svg>
                </button>
                {(isExec(currentUser) || isCoach(currentUser)) && (
                  <button 
                    className="new-post-btn"
                    onClick={() => setShowWorkoutForm(true)}
                  >
                    +<span className="btn-text"> New Workout</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filters Container */}
            <div className={`filters-container ${showFilters ? 'filters-visible' : ''}`}>
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
                  🚴‍♂️ Bike
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
                  <div key={post.id} className="post-card workout-post" onClick={(e) => {
                      // Only navigate if clicking on the card itself, not on buttons or edit form
                      if (!e.target.closest('.workout-actions-admin') && !e.target.closest('.workout-edit-form')) {
                        window.location.href = `/workout/${post.id}`;
                      }
                    }}>
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
                            ✏️<span className="btn-text"> Edit</span>
                          </button>
                          <button 
                            className="delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWorkout(post.id);
                            }}
                            disabled={editingWorkout === post.id}
                          >
                            🗑️<span className="btn-text"> Delete</span>
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
            );
          })()}
          </div>
        )}
        

        {/* Events Section */}
        {activeTab === 'events' && (
          <div className="events-section">
            <div className="section-header">
              <h2>Event Posts</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Offline/Cache Indicator */}
                {eventsFromCache && (
                  <span className="cache-indicator" title="Showing cached data">
                    📦 Cached
                  </span>
                )}
                {eventsOffline && (
                  <span className="offline-badge" title="You're offline">
                    📴 Offline
                  </span>
                )}
                {isMember(currentUser) && (
                  <button 
                    className="new-post-btn"
                    onClick={() => setShowEventForm(true)}
                  >
                    +<span className="btn-text"> New Event</span>
                  </button>
                )}
              </div>
            </div>

            {eventPosts.length === 0 ? (
              <p className="no-posts">{eventsLoadingFromCache ? 'Events loading...' : 'No event posts yet.'}</p>
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
                                ✏️<span className="btn-text"> Edit</span>
                              </button>
                              <button 
                                className="delete-btn"
                                onClick={(e) => { e.stopPropagation(); handleDeleteEvent(post.id); }}
                                disabled={editingEvent === post.id}
                              >
                                🗑️<span className="btn-text"> Delete</span>
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
        {showWorkoutForm && createPortal(
          <div 
            className="modal-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              minWidth: '100vw',
              minHeight: '100vh',
              maxWidth: '100vw',
              maxHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: 0,
              padding: '1rem',
              boxSizing: 'border-box',
              zIndex: 99999,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              overflow: 'hidden'
            }}
          >
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
                    ref={workoutDateInputRef}
                    onFocus={(e) => { try { e.target.removeAttribute('min'); } catch (_) {} }}
                    onChange={(e) => {
                      console.log('📅 Date selected:', e.target.value);
                      setWorkoutForm({...workoutForm, date: e.target.value});
                    }}
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
          </div>,
          document.body
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

        <ConfirmModal
          isOpen={deleteWorkoutConfirm.isOpen}
          onConfirm={confirmDeleteWorkout}
          onCancel={() => setDeleteWorkoutConfirm({ isOpen: false, postId: null })}
          title="Delete Workout"
          message="Are you sure you want to delete this workout post?"
          confirmText="Delete"
          cancelText="Cancel"
          confirmDanger={true}
        />

        <ConfirmModal
          isOpen={deleteEventConfirm.isOpen}
          onConfirm={confirmDeleteEvent}
          onCancel={() => setDeleteEventConfirm({ isOpen: false, postId: null })}
          title="Delete Event"
          message="Are you sure you want to delete this event post?"
          confirmText="Delete"
          cancelText="Cancel"
          confirmDanger={true}
        />
    </div>
    </PullToRefresh>
  );
};


export default Forum;

