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

  const API_BASE_URL = 'http://localhost:5001/api';

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

      // Load RSVPs (placeholder for now)
      setRsvps([
        { id: 1, user_name: 'John Doe', status: 'going', signed_up_at: '2024-01-15' },
        { id: 2, user_name: 'Jane Smith', status: 'maybe', signed_up_at: '2024-01-15' },
        { id: 3, user_name: 'Bob Wilson', status: 'not-going', signed_up_at: '2024-01-15' }
      ]);

      // Load comments (placeholder for now)
      setComments([
        { id: 1, user_name: 'John Doe', content: 'Looking forward to this event!', created_at: '2024-01-15' },
        { id: 2, user_name: 'Jane Smith', content: 'What should I bring?', created_at: '2024-01-15' }
      ]);

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

      // Update local state immediately for better UX
      const newRsvp = {
        id: Date.now(),
        user_name: currentUser.name,
        status: status,
        signed_up_at: new Date().toISOString().split('T')[0]
      };

      // Remove existing RSVP if any
      const filteredRsvps = rsvps.filter(r => r.user_name !== currentUser.name);
      
      if (userRsvp === status) {
        // User is clicking the same status, remove RSVP
        setRsvps(filteredRsvps);
        setUserRsvp(null);
      } else {
        // User is changing RSVP status
        setRsvps([...filteredRsvps, newRsvp]);
        setUserRsvp(status);
      }

      // TODO: Add backend API call for RSVP functionality
      console.log('RSVP updated:', status);
    } catch (error) {
      console.error('Error updating RSVP:', error);
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
        <button className="back-btn" onClick={() => navigate('/forum')}>
          ← Back to Forum
        </button>

        <div className="event-detail-card">
          <div className="event-header">
            <h1 className="event-title">{event.title}</h1>
            <div className="event-author">
              <div className="author-info">
                {event.authorProfilePictureUrl ? (
                  <img 
                    src={`http://localhost:5001${event.authorProfilePictureUrl}`} 
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
                          src={`http://localhost:5001${comment.userProfilePictureUrl}`} 
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

