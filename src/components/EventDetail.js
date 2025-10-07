import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './EventDetail.css';

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isMember } = useAuth();
  const [event, setEvent] = useState(null);
  const [rsvps, setRsvps] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [userRsvp, setUserRsvp] = useState(null); // 'going', 'maybe', 'not_going', or null
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', date: '', content: '' });
  const [saving, setSaving] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    if (!isMember(currentUser)) {
      navigate('/login');
      return;
    }
    
    loadEventDetails();
  }, [currentUser, navigate, isMember, id]);

  const loadEventDetails = async () => {
    try {
      console.log('🔄 EventDetail: Starting to load event details...');
      console.log('🆔 Event ID:', id);
      console.log('👤 Current user:', currentUser);
      
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('❌ No authentication token found');
        return;
      }
      console.log('🔑 Token found:', token.substring(0, 20) + '...');

      // Load event details
      console.log('📡 Fetching event from:', `${API_BASE_URL}/forum/events/${id}`);
      const eventResponse = await fetch(`${API_BASE_URL}/forum/events/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('📡 Event response status:', eventResponse.status);
      console.log('📡 Event response ok:', eventResponse.ok);

      if (eventResponse.ok) {
        const eventData = await eventResponse.json();
        console.log('📊 Full event data received:', eventData);
        console.log('📊 Event object:', eventData.event);
        console.log('📊 RSVPs array:', eventData.rsvps);
        
        setEvent(eventData.event);
        setEditForm({
          title: eventData.event?.title || '',
          date: eventData.event?.event_date ? String(eventData.event.event_date).split('T')[0] : '',
          content: eventData.event?.content || ''
        });
        
        // Load RSVPs from backend response
        if (eventData.rsvps) {
          console.log('✅ Setting RSVPs state with:', eventData.rsvps);
          console.log('🔍 RSVP profile picture URLs:');
          eventData.rsvps.forEach((rsvp, index) => {
            console.log(`  RSVP ${index}: userProfilePictureUrl = "${rsvp.userProfilePictureUrl}"`);
          });
          setRsvps(eventData.rsvps);
          
          // Set current user's RSVP status
          const userRsvp = eventData.rsvps.find(rsvp => rsvp.user_id === currentUser.id);
          console.log('🔍 Looking for user RSVP with user_id:', currentUser.id);
          console.log('🔍 Found user RSVP:', userRsvp);
          
          if (userRsvp) {
            console.log('✅ Setting userRsvp state to:', userRsvp.status);
            setUserRsvp(userRsvp.status);
          } else {
            console.log('ℹ️ No RSVP found for current user');
            setUserRsvp(null);
          }
        } else {
          console.log('⚠️ No RSVPs data in response');
          setRsvps([]);
        }
      } else {
        console.error('❌ Event response not ok');
        const errorText = await eventResponse.text();
        console.error('❌ Error response:', errorText);
      }

      // Load comments (will be implemented when backend is ready)
      setComments([]);

      setLoading(false);
      console.log('✅ EventDetail: Finished loading event details');
    } catch (error) {
      console.error('❌ Error loading event details:', error);
      setLoading(false);
    }
  };

  const handleRsvp = async (status) => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      // Call backend API to save RSVP
      const response = await fetch(`${API_BASE_URL}/forum/events/${id}/rsvp`, {
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
        if (result.status === null) {
          // RSVP was removed
          const filteredRsvps = rsvps.filter(r => r.user_name !== currentUser.name);
          setRsvps(filteredRsvps);
          setUserRsvp(null);
        } else {
          // RSVP was added/updated
          const filteredRsvps = rsvps.filter(r => r.user_name !== currentUser.name);
          const newRsvp = {
            id: Date.now(),
            user_id: currentUser.id,
            user_name: currentUser.name,
            status: result.status,
            signed_up_at: new Date().toISOString().split('T')[0]
          };
          setRsvps([...filteredRsvps, newRsvp]);
          setUserRsvp(result.status);
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

  const canManage = () => {
    if (!currentUser || !event) return false;
    return currentUser.id === event.user_id || currentUser.role === 'exec' || currentUser.role === 'administrator';
  };

  const saveEvent = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('triathlonToken');
      if (!token) throw new Error('No authentication token found');

      const response = await fetch(`${API_BASE_URL}/forum/posts/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: editForm.title,
          eventDate: editForm.date,
          content: editForm.content
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update event');
      }

      setSaving(false);
      setEditMode(false);
      await loadEventDetails();
      alert('Event updated successfully!');
    } catch (error) {
      setSaving(false);
      console.error('Error updating event:', error);
      alert(error.message || 'Error updating event');
    }
  };

  const handleDeleteEvent = async () => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) throw new Error('No authentication token found');

      const response = await fetch(`${API_BASE_URL}/forum/posts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete event');
      }

      navigate('/forum?tab=events');
    } catch (error) {
      console.error('Error deleting event:', error);
      alert(error.message || 'Error deleting event');
    }
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
        created_at: new Date().toISOString().split('T')[0]
      };

      setComments([...comments, newCommentObj]);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading event details...</div>;
  }

  if (!event) {
    return <div className="error">Event not found</div>;
  }

  return (
    <div className="event-detail-container">
      <div className="container">
        <button className="back-btn" onClick={() => navigate('/forum?tab=events')}>
          ← Back to Forum
        </button>

        <div className="event-detail-card">
          <div className="event-header">
            <h1 className="event-title">{editMode ? (
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="form-input"
                placeholder="Event title"
              />
            ) : (
              event.title
            )}</h1>
            <div className="event-author">
              <div className="author-info">
                {(() => {
                  const { normalizeProfileImageUrl } = require('../utils/imageUtils');
                  const url = normalizeProfileImageUrl(event.authorProfilePictureUrl);
                  return url ? (
                    <img 
                      src={url}
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
                  );
                })()}
                <span className="author-name">Posted by {event.author_name}</span>
              </div>
              {canManage() && (
                <div className="workout-actions-admin">
                  {!editMode ? (
                    <>
                      <button 
                        className="edit-btn"
                        onClick={() => setEditMode(true)}
                        disabled={saving}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        className="delete-btn"
                        onClick={handleDeleteEvent}
                        disabled={saving}
                      >
                        🗑️ Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        className="btn btn-primary"
                        onClick={saveEvent}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button 
                        className="btn btn-secondary"
                        onClick={() => setEditMode(false)}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {(event.event_date || editMode) && (
            <div className="event-meta">
              {editMode ? (
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="form-input"
                />
              ) : (
                <span className="event-date">📅 {new Date(event.event_date).toLocaleDateString()}</span>
              )}
            </div>
          )}

          <div className="event-content">
            {editMode ? (
              <textarea
                value={editForm.content}
                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                className="form-textarea"
                rows="4"
                placeholder="Event details..."
              />
            ) : (
              event.content
            )}
          </div>

          <div className="event-actions">
            <div className="rsvp-buttons">
              <button 
                onClick={() => handleRsvp('going')}
                className={`rsvp-btn going ${userRsvp === 'going' ? 'active' : ''}`}
              >
                {userRsvp === 'going' ? '✓ Going' : 'Going'}
              </button>
              <button 
                onClick={() => handleRsvp('maybe')}
                className={`rsvp-btn maybe ${userRsvp === 'maybe' ? 'active' : ''}`}
              >
                {userRsvp === 'maybe' ? '✓ Maybe' : 'Maybe'}
              </button>
              <button 
                onClick={() => handleRsvp('not_going')}
                className={`rsvp-btn not-going ${userRsvp === 'not_going' ? 'active' : ''}`}
              >
                {userRsvp === 'not_going' ? '✓ Not Going' : 'Not Going'}
              </button>
            </div>
          </div>
        </div>

        <div className="rsvps-section">
          <h2>Who's Coming</h2>
          
          <div className="rsvp-categories">
            <div className="rsvp-category">
              <h3>Going ({rsvps.filter(r => r.status === 'going').length})</h3>
              {rsvps.filter(r => r.status === 'going').length === 0 ? (
                <p className="no-rsvps">No one has confirmed yet.</p>
              ) : (
                <div className="rsvp-list">
                  {rsvps.filter(r => r.status === 'going').map(rsvp => (
                    <div key={rsvp.id} className="rsvp-item going">
                      <div className="rsvp-user-info">
                        {rsvp.userProfilePictureUrl ? (
                          <img 
                            src={`${API_BASE_URL.replace('/api', '')}${rsvp.userProfilePictureUrl}`} 
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
                        <span className="rsvp-user">{rsvp.user_name}</span>
                      </div>
                      <span className="rsvp-date">
                        {rsvp.rsvp_time && rsvp.rsvp_time !== 'Invalid Date' && rsvp.rsvp_time !== 'null' 
                          ? new Date(rsvp.rsvp_time).toLocaleDateString()
                          : 'Recently'
                        }
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rsvp-category">
              <h3>Maybe ({rsvps.filter(r => r.status === 'maybe').length})</h3>
              {rsvps.filter(r => r.status === 'maybe').length === 0 ? (
                <p className="no-rsvps">No maybes yet.</p>
              ) : (
                <div className="rsvp-list">
                  {rsvps.filter(r => r.status === 'maybe').map(rsvp => (
                    <div key={rsvp.id} className="rsvp-item maybe">
                      <div className="rsvp-user-info">
                        {rsvp.userProfilePictureUrl ? (
                          <img 
                            src={`${API_BASE_URL.replace('/api', '')}${rsvp.userProfilePictureUrl}`} 
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
                        <span className="rsvp-user">{rsvp.user_name}</span>
                      </div>
                      <span className="rsvp-date">
                        {rsvp.rsvp_time && rsvp.rsvp_time !== 'Invalid Date' && rsvp.rsvp_time !== 'null' 
                          ? new Date(rsvp.rsvp_time).toLocaleDateString()
                          : 'Recently'
                        }
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rsvp-category">
              <h3>Not Going ({rsvps.filter(r => r.status === 'not_going').length})</h3>
              {rsvps.filter(r => r.status === 'not_going').length === 0 ? (
                <p className="no-rsvps">No declines yet.</p>
              ) : (
                <div className="rsvp-list">
                  {rsvps.filter(r => r.status === 'not_going').map(rsvp => (
                    <div key={rsvp.id} className="rsvp-item not-going">
                      <div className="rsvp-user-info">
                        {rsvp.userProfilePictureUrl ? (
                          <img 
                            src={`${API_BASE_URL.replace('/api', '')}${rsvp.userProfilePictureUrl}`} 
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
                        <span className="rsvp-user">{rsvp.user_name}</span>
                      </div>
                      <span className="rsvp-date">
                        {rsvp.rsvp_time && rsvp.rsvp_time !== 'Invalid Date' && rsvp.rsvp_time !== 'null' 
                          ? new Date(rsvp.rsvp_time).toLocaleDateString()
                          : 'Recently'
                        }
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
                          src={`${API_BASE_URL.replace('/api', '')}${comment.userProfilePictureUrl}`} 
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
                    <span className="comment-date">{comment.created_at}</span>
                  </div>
                  <div className="comment-content">{comment.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventDetail;

