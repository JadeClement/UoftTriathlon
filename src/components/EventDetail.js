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
  const [userRsvp, setUserRsvp] = useState(null); // 'going', 'maybe', 'not-going', or null

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
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      // Load event details
      const eventResponse = await fetch(`${API_BASE_URL}/forum/events/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (eventResponse.ok) {
        const eventData = await eventResponse.json();
        setEvent(eventData.event);
      }

      // Load RSVPs (will be implemented when backend is ready)
      setRsvps([]);

      // Load comments (will be implemented when backend is ready)
      setComments([]);

      setLoading(false);
    } catch (error) {
      console.error('Error loading event details:', error);
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
            <h1 className="event-title">{event.title}</h1>
            <div className="event-author">
              <div className="author-info">
                {event.authorProfilePictureUrl ? (
                  <img 
                    src={`${API_BASE_URL}/..${event.authorProfilePictureUrl}`} 
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
                <span className="author-name">Posted by {event.author_name}</span>
              </div>
            </div>
          </div>

          {event.event_date && (
            <div className="event-meta">
              <span className="event-date">
                📅 {new Date(event.event_date).toLocaleDateString()}
              </span>
            </div>
          )}

          <div className="event-content">
            {event.content}
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
                onClick={() => handleRsvp('not-going')}
                className={`rsvp-btn not-going ${userRsvp === 'not-going' ? 'active' : ''}`}
              >
                {userRsvp === 'not-going' ? '✓ Not Going' : 'Not Going'}
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
                            src={`http://localhost:5001${rsvp.userProfilePictureUrl}`} 
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
                        {new Date(rsvp.signed_up_at).toLocaleDateString()}
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
                            src={`http://localhost:5001${rsvp.userProfilePictureUrl}`} 
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
                        {new Date(rsvp.signed_up_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rsvp-category">
              <h3>Not Going ({rsvps.filter(r => r.status === 'not-going').length})</h3>
              {rsvps.filter(r => r.status === 'not-going').length === 0 ? (
                <p className="no-rsvps">No declines yet.</p>
              ) : (
                <div className="rsvp-list">
                  {rsvps.filter(r => r.status === 'not-going').map(rsvp => (
                    <div key={rsvp.id} className="rsvp-item not-going">
                      <div className="rsvp-user-info">
                        {rsvp.userProfilePictureUrl ? (
                          <img 
                            src={`http://localhost:5001${rsvp.userProfilePictureUrl}`} 
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
                        {new Date(rsvp.signed_up_at).toLocaleDateString()}
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
                          src={`${API_BASE_URL}/..${comment.userProfilePictureUrl}`} 
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

