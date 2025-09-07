import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useWorkoutEdit } from '../hooks/useWorkoutEdit';
import './Forum.css';

const Forum = () => {
  const { currentUser, isMember, isExec, getUserRole } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('workouts');
  const [workoutPosts, setWorkoutPosts] = useState([]);
  const [eventPosts, setEventPosts] = useState([]);
  const [newWorkout, setNewWorkout] = useState('');
  const [newEvent, setNewEvent] = useState('');
  const [loading, setLoading] = useState(true);
  const [showWorkoutForm, setShowWorkoutForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [workoutFilter, setWorkoutFilter] = useState('all');
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
  const [workoutSignups, setWorkoutSignups] = useState({});
  const [workoutWaitlists, setWorkoutWaitlists] = useState({});
  const [eventRsvps, setEventRsvps] = useState({});
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [workoutToCancel, setWorkoutToCancel] = useState(null);
  const [showPromotionMessage, setShowPromotionMessage] = useState(false);
  const [promotedWorkout, setPromotedWorkout] = useState(null);
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';
  
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
    
    // Check if user has member access or higher
    if (!isMember(currentUser)) {
      navigate('/login');
      return;
    }
    
    // Load forum posts from backend API
    loadForumPosts();
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

      // Load workout posts
      const workoutResponse = await fetch(`${API_BASE_URL}/forum/posts?type=workout`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (workoutResponse.ok) {
        const workoutData = await workoutResponse.json();
        console.log('🔍 Workout data received:', workoutData);
        
        // Ensure we have valid posts data
        const posts = workoutData.posts || workoutData || [];
        console.log('🔍 Posts to set:', posts);
        
        // Filter out any invalid posts
        const validPosts = posts.filter(post => post && post.id && typeof post === 'object');
        console.log('🔍 Valid posts:', validPosts);
        
        setWorkoutPosts(validPosts);
        
        // Load signup data for all workouts
        await loadWorkoutSignups(validPosts);
        // Load waitlist data for all workouts
        await loadWorkoutWaitlists(validPosts);
      }

      // Load event posts
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
        
        // Load RSVP data for all events
        await loadEventRsvps(validPosts);
      }
    } catch (error) {
      console.error('Error loading forum posts:', error);
    } finally {
      setLoading(false);
    }
  };

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
            alert(`Sorry, this workout is full! Maximum capacity: ${workout.capacity} people.`);
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
    const isSignedUp = signups.some(signup => signup && signup.user_id === currentUser.id);
    console.log(`🔍 isUserSignedUp for workout ${workoutId}:`, {
      workoutId,
      currentUser: currentUser.id,
      currentUserEmail: currentUser.email,
      signups,
      isSignedUp
    });
    return isSignedUp;
  };

  const isWorkoutFull = (workoutId) => {
    if (!workoutId) return false;
    const workout = workoutPosts.find(w => w && w.id === workoutId);
    if (!workout || !workout.capacity) return false;
    const currentSignups = workoutSignups[workoutId]?.length || 0;
    return currentSignups >= workout.capacity;
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



  // Filter workouts based on selected filter
  const getFilteredWorkouts = () => {
    if (workoutFilter === 'all') {
      return workoutPosts;
    }
    
    return workoutPosts.filter(post => {
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

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!currentUser) {
    return null;
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
              {isExec(currentUser) && (
                <button 
                  className="new-post-btn"
                  onClick={() => setShowWorkoutForm(true)}
                >
                  + New Workout
                </button>
              )}
            </div>

            {/* Workout Filter Buttons */}
            <div className="workout-filters">
              <button 
                className={`filter-btn ${workoutFilter === 'all' ? 'active' : ''}`}
                onClick={() => setWorkoutFilter('all')}
              >
                🏃‍♂️ All Workouts
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

            {getFilteredWorkouts().length === 0 ? (
              <p className="no-posts">
                {workoutPosts.length === 0 ? 'No workout posts yet.' : `No ${workoutFilter === 'all' ? '' : workoutFilter} workouts found.`}
              </p>
            ) : (
              <div className="posts-list">
                {getFilteredWorkouts().filter(post => post && post.id).map(post => (
                  <div key={post.id} className="post-card workout-post">
                    <div className="post-header">
                      {post.title ? (
                        <div className="workout-title">
                          <h2>
                            <a href={`/workout/${post.id}`} className="workout-title-link">
                              {post.title}
                            </a>
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
                            onClick={() => startEdit(post)}
                            disabled={editingWorkout === post.id}
                          >
                            ✏️ Edit
                          </button>
                          <button 
                            className="delete-btn"
                            onClick={() => handleDeleteWorkout(post.id)}
                            disabled={editingWorkout === post.id}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="workout-author">
                      <div className="author-info">
                        {post.authorProfilePictureUrl ? (
                          <img 
                            src={`http://localhost:5001${post.authorProfilePictureUrl}`} 
                            alt="Profile" 
                            className="author-avatar"
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
                        )}
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
                                📅 {new Date(post.workout_date).toLocaleDateString()}
                                {post.workout_time && (
                                  <span className="workout-time"> • 🕐 {post.workout_time}</span>
                                )}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="workout-content">
                          {post.content}
                        </div>
                      </>
                    )}

                    {/* Sign-up button positioned at bottom right */}
                    <div className="workout-signup-section">
                      <div className="button-group">
                        <button 
                          className={`signup-btn ${isUserSignedUp(post.id) ? 'signed-up' : ''} ${isWorkoutFull(post.id) ? 'full' : ''}`}
                          onClick={() => handleWorkoutSignUp(post.id)}
                          disabled={isWorkoutFull(post.id) && !isUserSignedUp(post.id)}
                        >
                          {isUserSignedUp(post.id) ? '✓ Signed Up' : isWorkoutFull(post.id) ? 'Full' : 'Sign Up'}
                        </button>
                        
                        {/* Cancel button for signed-up users */}
                        {isUserSignedUp(post.id) && (
                          <button 
                            className="cancel-btn"
                            onClick={() => handleCancelClick(post.id)}
                          >
                            Cancel
                          </button>
                        )}
                        
                        {/* Waitlist button for full workouts */}
                        {post.capacity && isWorkoutFull(post.id) && !isUserSignedUp(post.id) && (
                          <button 
                            className={`waitlist-btn ${isUserOnWaitlist(post.id) ? 'on-waitlist' : ''}`}
                            onClick={() => isUserOnWaitlist(post.id) ? handleWaitlistLeave(post.id) : handleWaitlistJoin(post.id)}
                          >
                            {isUserOnWaitlist(post.id) ? 'Leave Waitlist' : 'Join Waitlist'}
                          </button>
                        )}
                        
                        {/* Position label when on waitlist */}
                        {post.capacity && isWorkoutFull(post.id) && isUserOnWaitlist(post.id) && (
                          <span className="waitlist-position">
                            {`You're ${formatOrdinal(getWaitlistPosition(post.id))} on the waitlist`}
                          </span>
                        )}
                      </div>
                      
                      <div className="signup-count">
                        <div className="signup-main">
                          {post.capacity 
                            ? `${workoutSignups[post.id]?.length || 0}/${post.capacity} signed up`
                            : `${workoutSignups[post.id]?.length || 0} signed up`
                          }
                        </div>
                        {post.capacity && (
                          <div className="signup-details">
                            <span className={`capacity-status ${isWorkoutFull(post.id) ? 'full' : 'available'}`}>
                              {isWorkoutFull(post.id) ? 'Full' : 'Available'}
                            </span>
                            {post.capacity && workoutWaitlists[post.id]?.length > 0 && (
                              <span className="waitlist-count">
                                {workoutWaitlists[post.id].length} on waitlist
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
              <p className="no-posts">No event posts yet.</p>
            ) : (
              <div className="posts-list">
                {eventPosts.map(post => (
                  <div key={post.id} className="post-card event-post">
                    <div className="post-header">
                      {post.title && (
                        <div className="event-title">
                          <h3>
                            <a href={`/event/${post.id}`} className="event-title-link">
                              {post.title}
                            </a>
                          </h3>
                        </div>
                      )}
                      
                      {/* Delete button for event author */}
                      {currentUser.id === post.user_id && (
                        <button 
                          className="delete-btn"
                          onClick={() => handleDeleteEvent(post.id)}
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                    
                    <div className="event-author">
                      <div className="author-info">
                        {post.authorProfilePictureUrl ? (
                          <img 
                            src={`http://localhost:5001${post.authorProfilePictureUrl}`} 
                            alt="Profile" 
                            className="author-avatar"
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
                        )}
                        <span className="author-name">Posted by {post.author_name}</span>
                      </div>
                    </div>
                    
                    {post.event_date && (
                      <div className="event-meta">
                        <span className="event-date">
                          📅 {new Date(post.event_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    
                    <div className="post-footer">
                      <div className="rsvp-buttons">
                        <button 
                          className={`rsvp-btn going ${getUserRsvpStatus(post.id) === 'going' ? 'active' : ''}`}
                          onClick={() => handleEventRsvp(post.id, 'going')}
                        >
                          {getUserRsvpStatus(post.id) === 'going' ? '✓ Going' : 'Going'}
                        </button>
                        <button 
                          className={`rsvp-btn maybe ${getUserRsvpStatus(post.id) === 'maybe' ? 'active' : ''}`}
                          onClick={() => handleEventRsvp(post.id, 'maybe')}
                        >
                          {getUserRsvpStatus(post.id) === 'maybe' ? '✓ Maybe' : 'Maybe'}
                        </button>
                        <button 
                          className={`rsvp-btn not-going ${getUserRsvpStatus(post.id) === 'not_going' ? 'active' : ''}`}
                          onClick={() => handleEventRsvp(post.id, 'not_going')}
                        >
                          {getUserRsvpStatus(post.id) === 'not_going' ? '✓ Not Going' : 'Not Going'}
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
                <p>⚠️ <strong>Important:</strong> If you cancel less than 24 hours in advance, it will count as an absence.</p>
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
                    <option value="spin">Spin</option>
                    <option value="outdoor-ride">Outdoor Ride</option>
                    <option value="run">Run</option>
                    <option value="swim">Swim</option>
                    <option value="brick">Brick (Bike + Run)</option>
                    <option value="other">Other</option>
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
