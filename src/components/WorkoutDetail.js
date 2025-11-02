import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkoutEdit } from '../hooks/useWorkoutEdit';
import { linkifyText } from '../utils/linkUtils';
import { combineDateTime, getHoursUntil, isWithinHours } from '../utils/dateUtils';
import { showSuccess, showError, showWarning } from './SimpleNotification';
import './WorkoutDetail.css';

const WorkoutDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isMember } = useAuth();
  const [workout, setWorkout] = useState(null);
  const [signups, setSignups] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [isOnWaitlist, setIsOnWaitlist] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [attendance, setAttendance] = useState({});
  const [lateStatus, setLateStatus] = useState({});
  const [attendanceSaved, setAttendanceSaved] = useState(false);
  const [submittingAttendance, setSubmittingAttendance] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState(false);
  const [swimMembers, setSwimMembers] = useState([]);
  const [isSwimWorkout, setIsSwimWorkout] = useState(false);
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
  
  const [editMode, setEditMode] = useState(false);

  const isWorkoutArchived = () => {
    try {
      if (!workout || !workout.workout_date) return false;
      
      // Parse the workout date and get just the date part (YYYY-MM-DD)
      const workoutDate = new Date(workout.workout_date);
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

  // Helpers for waitlist position display
  const getWaitlistPosition = () => {
    const idx = waitlist.findIndex(w => w.user_id === currentUser.id);
    return idx === -1 ? null : idx + 1;
  };

  const formatOrdinal = (n) => {
    if (n == null) return '';
    const s = ["th","st","nd","rd"], v = n % 100;
    return n + (s[(v-20)%10] || s[v] || s[0]);
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    if (!isMember(currentUser)) {
      navigate('/login');
      return;
    }
    
    loadWorkoutDetails();
  }, [currentUser, navigate, isMember, id]);

  // Listen for profile updates to refresh profile pictures
  useEffect(() => {
    const handleProfileUpdate = (event) => {
      console.log('🔄 Profile updated event received, refreshing workout details...');
      loadWorkoutDetails();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  const loadWorkoutDetails = async () => {
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

      // Load comments (will be implemented with real backend data)
      setComments([]);


      setLoading(false);
    } catch (error) {
      console.error('Error loading workout details:', error);
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
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
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating signup:', error);
      alert('Error updating signup');
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
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error joining waitlist:', error);
      alert('Error joining waitlist');
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
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error leaving waitlist:', error);
      alert('Error leaving waitlist');
    }
  };

  const handleCancelClick = () => {
    setShowCancelModal(true);
  };



  const handleDeleteWorkout = async () => {
    if (!window.confirm('Are you sure you want to delete this workout post?')) {
      return;
    }

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
      alert(`Error deleting workout: ${error.message}`);
    }
  };

  const handleCancelSignup = async () => {
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
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error canceling signup:', error);
      alert('Error canceling signup');
    }
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
  };

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
        alert(`Failed to save attendance: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error submitting attendance:', error);
      // Revert optimistic update on failure
      setAttendanceSaved(false);
      alert('Error submitting attendance. Please try again.');
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

      const newCommentObj = {
        id: Date.now(),
        user_name: currentUser.name,
        content: newComment.trim(),
        created_at: new Date().toISOString()
      };

      setComments([...comments, newCommentObj]);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading workout details...</div>;
  }

  if (!workout) {
    return <div className="error">Workout not found</div>;
  }

  return (
    <div className="workout-detail-container">
      <div className="container">
        <button className="back-btn" onClick={() => navigate('/forum')}>
          ← Back to Forum
        </button>

        <div className="workout-detail-card">
          <div className="workout-header">
            <div className="workout-title-section">
              <h1 className="workout-title">{workout.title}</h1>
              {/* Edit and Delete buttons for workout author or executives */}
              {(() => {
                const canEdit = currentUser.id === workout.user_id || currentUser.role === 'exec' || currentUser.role === 'administrator';
                console.log('🔍 Edit button permission check:', {
                  currentUserId: currentUser.id,
                  workoutUserId: workout.user_id,
                  currentUserRole: currentUser.role,
                  isAuthor: currentUser.id === workout.user_id,
                  isExec: currentUser.role === 'exec',
                  isAdmin: currentUser.role === 'administrator',
                  canEdit: canEdit
                });
                return canEdit;
              })() && (
                <div className="workout-actions-admin">
                  <button 
                    className="edit-btn"
                    onClick={() => {
                      startEdit(workout);
                      setEditMode(true);
                    }}
                    disabled={editMode}
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={handleDeleteWorkout}
                    disabled={editMode}
                  >
                    🗑️ Delete
                  </button>
                </div>
              )}
            </div>
            <div className="workout-author">
              <div className="author-info">
                                    {workout.authorProfilePictureUrl ? (
                      <img 
                        src={`${API_BASE_URL}${workout.authorProfilePictureUrl}`} 
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
                <span className="author-name">Posted by {workout.author_name}</span>
              </div>
            </div>
          </div>

          {workout.workout_type && (
            <div className="workout-meta">
              <span className="workout-type-badge">{workout.workout_type}</span>
              {workout.workout_date && (
                <span className="workout-date">
                  📅 {(() => { const b = workout.workout_date.split('T')[0]; const [y,m,d] = b.split('-').map(Number); return new Date(Date.UTC(y,m-1,d)).toLocaleDateString(undefined,{ timeZone: 'UTC' }); })()}
                  {workout.workout_time && (
                    <span className="workout-time"> • 🕐 {workout.workout_time}</span>
                  )}
                </span>
              )}
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
                      const result = await saveWorkout(workout.id, loadWorkoutDetails);
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
              {linkifyText(workout.content)}
            </div>
          )}

          {/* Only show signup/waitlist buttons for non-swim workouts */}
          {!isSwimWorkout && (
            <div className="workout-actions">
              <div className="button-group">
                {!isWorkoutArchived() && (
                  <button 
                    onClick={handleSignUp}
                    className={`signup-btn ${isSignedUp ? 'signed-up' : ''}`}
                    disabled={workout.capacity && signups.length >= workout.capacity && !isSignedUp}
                  >
                    {isSignedUp ? '✓ Signed Up' : (workout.capacity && signups.length >= workout.capacity) ? 'Full' : 'Sign Up'}
                  </button>
                )}
                
                {/* Cancel button for signed-up users */}
                {isSignedUp && !isWorkoutArchived() && (
                  <button 
                    onClick={handleCancelClick}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                )}
                
                {/* Waitlist button for full workouts */}
                {workout.capacity && signups.length >= workout.capacity && !isSignedUp && !isWorkoutArchived() && (
                  <button 
                    onClick={isOnWaitlist ? handleWaitlistLeave : handleWaitlistJoin}
                    className={`waitlist-btn ${isOnWaitlist ? 'on-waitlist' : ''}`}
                  >
                    {isOnWaitlist ? 'Leave Waitlist' : 'Join Waitlist'}
                  </button>
                )}

                {/* Position label when on waitlist */}
                {workout.capacity && signups.length >= workout.capacity && isOnWaitlist && !isWorkoutArchived() && (
                  <span className="waitlist-position">
                    {`You're ${formatOrdinal(getWaitlistPosition())} on the waitlist`}
                  </span>
                )}
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
                : `Who's Coming (${signups.length}${workout.capacity ? `/${workout.capacity}` : ''})`
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
            signups.length === 0 ? (
              <p className="no-signups">No one has signed up yet. Be the first!</p>
            ) : (
              <>
                <div className="signups-list">
                  {signups.map(signup => (
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
                          ? new Date(signup.signup_time).toLocaleDateString()
                          : 'Recently'
                        }
                        <span className="signup-time"> • 🕐 {signup.signup_time && signup.signup_time !== 'Invalid Date' && signup.signup_time !== 'null' 
                          ? new Date(signup.signup_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                          : 'Recently'
                        }</span>
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Submit attendance button for coaches, executives and administrators */}
                {currentUser && (currentUser.role === 'coach' || currentUser.role === 'exec' || currentUser.role === 'administrator') && signups.length > 0 && (
                  <div className="attendance-submit">
                    <div className="attendance-debug">
                      <small>📊 {signups.length} signups • {Object.keys(attendance).length} attendance records</small>
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
        {!isSwimWorkout && workout.capacity && waitlist.length > 0 && (
          <div className="waitlist-section">
            <h2>Waitlist ({waitlist.length})</h2>
            <div className="waitlist-list">
              {waitlist.map(waitlistItem => (
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

        {/* Cancel Confirmation Modal */}
        {showCancelModal && workout && (() => {
          // Calculate hours until workout
          const workoutDateTime = workout.workout_date && workout.workout_time 
            ? combineDateTime(workout.workout_date, workout.workout_time)
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
    </div>
  );
};

export default WorkoutDetail;
