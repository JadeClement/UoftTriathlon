import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './RaceDetail.css';

const RaceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isMember } = useAuth();
  const [race, setRace] = useState(null);
  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
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
    
    loadRaceDetails();
  }, [currentUser, navigate, isMember, id]);

  const loadRaceDetails = async () => {
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/races/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🏁 Race data received:', data);
        console.log('👥 Signups data:', data.signups);
        
        // Debug each signup
        if (data.signups) {
          data.signups.forEach((signup, index) => {
            console.log(`👤 Signup ${index + 1}:`, {
              name: signup.user_name,
              profilePictureUrl: signup.userProfilePictureUrl,
              hasProfilePicture: !!signup.userProfilePictureUrl
            });
          });
        }
        
        setRace(data.race);
        setSignups(data.signups || []);
        setIsSignedUp(data.isSignedUp || false);
      } else {
        console.error('Failed to load race details');
        navigate('/races');
      }
    } catch (error) {
      console.error('Error loading race details:', error);
      navigate('/races');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (signupLoading) return;
    
    setSignupLoading(true);
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/races/${id}/signup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        console.log('✅ Race signup successful');
        await loadRaceDetails(); // Refresh to show updated signup status
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to sign up for race:', errorData);
        alert(errorData.error || 'Failed to sign up for race');
      }
    } catch (error) {
      console.error('❌ Error signing up for race:', error);
      alert('Failed to sign up for race');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleCancelSignup = async () => {
    if (signupLoading) return;
    
    setSignupLoading(true);
    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/races/${id}/signup`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        console.log('✅ Race signup cancelled successfully');
        await loadRaceDetails(); // Refresh to show updated signup status
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to cancel signup:', errorData);
        alert(errorData.error || 'Failed to cancel signup');
      }
    } catch (error) {
      console.error('❌ Error cancelling signup:', error);
      alert('Failed to cancel signup');
    } finally {
      setSignupLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="race-detail-container">
        <div className="loading">Loading race details...</div>
      </div>
    );
  }

  if (!race) {
    return (
      <div className="race-detail-container">
        <div className="error">Race not found</div>
      </div>
    );
  }

  return (
    <div className="race-detail-container">
      <div className="race-detail-content">
        <div className="race-header">
          <button onClick={() => navigate('/races')} className="back-btn">
            ← Back to Races
          </button>
          <h1>{race.name}</h1>
          <div className="race-date">{formatDate(race.date)}</div>
        </div>

        <div className="race-info">
          {race.location && (
            <div className="info-section">
              <h3>📍 Location</h3>
              <p>{race.location}</p>
            </div>
          )}

          {race.description && (
            <div className="info-section">
              <h3>📝 Description</h3>
              <p>{race.description}</p>
            </div>
          )}

          <div className="info-section">
            <h3>👥 Who's Going ({signups.length})</h3>
            {signups.length === 0 ? (
              <p className="no-signups">No one has signed up yet. Be the first!</p>
            ) : (
              <div className="signups-list">
                {signups.map((signup, index) => (
                  <div key={signup.id || index} className="signup-item">
                    <div className="signup-avatar">
                      {signup.userProfilePictureUrl ? (
                        <img 
                          src={`${API_BASE_URL.replace('/api', '')}${signup.userProfilePictureUrl}`}
                          alt={signup.user_name}
                          className="avatar-img"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="avatar-placeholder" 
                        style={{ display: signup.userProfilePictureUrl ? 'none' : 'flex' }}
                      >
                        {signup.user_name ? signup.user_name.charAt(0).toUpperCase() : '?'}
                      </div>
                    </div>
                    <div className="signup-info">
                      <div className="signup-name">{signup.user_name}</div>
                      <div className="signup-time">
                        📅 {signup.signup_time && signup.signup_time !== 'Invalid Date' && signup.signup_time !== 'null'
                          ? new Date(signup.signup_time).toLocaleDateString()
                          : 'Recently'
                        }
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="race-actions">
          {isSignedUp ? (
            <button 
              onClick={handleCancelSignup}
              disabled={signupLoading}
              className="cancel-btn"
            >
              {signupLoading ? 'Cancelling...' : 'Cancel Signup'}
            </button>
          ) : (
            <button 
              onClick={handleSignup}
              disabled={signupLoading}
              className="signup-btn"
            >
              {signupLoading ? 'Signing up...' : 'Sign Up for Race'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RaceDetail;
