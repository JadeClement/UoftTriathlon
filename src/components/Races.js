import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Races.css';

const Races = () => {
  const { currentUser, isMember } = useAuth();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddRace, setShowAddRace] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all' or 'going'
  const [addRaceForm, setAddRaceForm] = useState({
    name: '',
    date: '',
    location: '',
    description: ''
  });

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

  useEffect(() => {
    loadRaces();
  }, []);

  const loadRaces = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/races`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRaces(data.races || []);
      } else {
        console.error('Failed to load races');
      }
    } catch (error) {
      console.error('Error loading races:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRace = async (e) => {
    e.preventDefault();
    
    if (!addRaceForm.name || !addRaceForm.date) {
      alert('Race name and date are required');
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/races`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(addRaceForm)
      });

      if (response.ok) {
        await loadRaces();
        setShowAddRace(false);
        setAddRaceForm({
          name: '',
          date: '',
          location: '',
          description: ''
        });
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to add race');
      }
    } catch (error) {
      console.error('Error adding race:', error);
      alert('Failed to add race');
    }
  };

  const handleSignUp = async (raceId) => {
    if (!currentUser || !isMember(currentUser)) {
      alert('You must be a member to sign up for races');
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/races/${raceId}/signup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await loadRaces(); // Refresh to show updated signup status
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to sign up for race');
      }
    } catch (error) {
      console.error('Error signing up for race:', error);
      alert('Failed to sign up for race');
    }
  };

  const handleCancelSignup = async (raceId) => {
    console.log('🔄 Attempting to cancel signup for race:', raceId);
    try {
      const token = localStorage.getItem('triathlonToken');
      console.log('🔑 Token found:', !!token);
      
      const response = await fetch(`${API_BASE_URL}/races/${raceId}/signup`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('📡 Response status:', response.status);
      
      if (response.ok) {
        console.log('✅ Signup canceled successfully');
        await loadRaces(); // Refresh to show updated signup status
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to cancel signup:', errorData);
        alert(errorData.error || 'Failed to cancel signup');
      }
    } catch (error) {
      console.error('❌ Error canceling signup:', error);
      alert('Failed to cancel signup');
    }
  };

  const handleDeleteRace = async (raceId) => {
    if (!window.confirm('Are you sure you want to delete this race? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('triathlonToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/races/${raceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await loadRaces();
        alert('Race deleted successfully!');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete race');
      }
    } catch (error) {
      console.error('Error deleting race:', error);
      alert(`Error deleting race: ${error.message}`);
    }
  };

  const isUserSignedUp = (race) => {
    if (!currentUser) return false;
    return race.signups && race.signups.some(signup => signup.user_id === currentUser.id);
  };

  const handleRaceClick = (raceId) => {
    navigate(`/race/${raceId}`);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysUntilRace = (dateString) => {
    const raceDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    raceDate.setHours(0, 0, 0, 0); // Reset time to start of day
    
    const diffTime = raceDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `Past (${Math.abs(diffDays)} days ago)`;
    } else if (diffDays === 0) {
      return 'Today!';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else {
      return `${diffDays} days`;
    }
  };

  const getMonthName = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getFilteredRaces = () => {
    if (filterMode === 'going') {
      return races.filter(race => isUserSignedUp(race));
    }
    return races;
  };

  const groupRacesByMonth = () => {
    const filteredRaces = getFilteredRaces();
    const grouped = {};
    filteredRaces.forEach(race => {
      const monthKey = getMonthName(race.date);
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(race);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="races-container">
        <div className="loading">Loading races...</div>
      </div>
    );
  }

  return (
    <div className="races-container">
      <div className="races-content">
        <div className="races-header">
          <h1>Races</h1>
                  <div className="view-toggle">
          <button 
            className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            📋 List View
          </button>
          <button 
            className={`toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
            onClick={() => setViewMode('calendar')}
          >
            📅 Calendar View
          </button>
        </div>
          {currentUser && isMember(currentUser) && (
            <button 
              className="add-race-btn"
              onClick={() => setShowAddRace(true)}
            >
              ➕ Add Race
            </button>
          )}
        </div>

      {/* Filter Toggle - Above Content */}
      {currentUser && isMember(currentUser) && (
        <div className="filter-section">
          <div className="filter-toggle">
            <button 
              className={`filter-btn ${filterMode === 'all' ? 'active' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              All Races
            </button>
            <button 
              className={`filter-btn ${filterMode === 'going' ? 'active' : ''}`}
              onClick={() => setFilterMode('going')}
            >
              Races I'm Going To
            </button>
          </div>
        </div>
      )}

      {viewMode === 'list' ? (
        <div className="races-list">
          {getFilteredRaces().length === 0 ? (
            <div className="no-races">
              {filterMode === 'going' ? (
                <>
                  <p>You're not signed up for any races yet.</p>
                  <p>Sign up for some races to see them here!</p>
                </>
              ) : (
                <>
                  <p>No races scheduled yet.</p>
                  {currentUser && isMember(currentUser) && (
                    <p>Be the first to add a race!</p>
                  )}
                </>
              )}
            </div>
          ) : (
            getFilteredRaces().map(race => (
              <div key={race.id} className="race-card" onClick={() => handleRaceClick(race.id)}>
                <div className="race-header">
                  <h3>{race.name}</h3>
                  <div className="race-date-info">
                    <span className="race-date">{formatDate(race.date)}</span>
                    <span className="race-countdown">{getDaysUntilRace(race.date)}</span>
                  </div>
                </div>
                <div className="race-details">
                  {race.location && <p><strong>📍 Location:</strong> {race.location}</p>}
                  {race.description && <p><strong>📝 Description:</strong> {race.description}</p>}
                </div>
                                  <div className="race-footer">
                    <div className="signup-info">
                      {currentUser && isMember(currentUser) && (
                        <>
                          <span className="signup-count">
                            {race.signups ? race.signups.length : 0} signed up
                          </span>
                          <span className="signup-status">
                            {isUserSignedUp(race) ? '✅ You\'re going!' : '❌ Not going'}
                          </span>
                        </>
                      )}
                    </div>
                    {currentUser && isMember(currentUser) && (
                      <div className="race-actions">
                        {isUserSignedUp(race) ? (
                          <button 
                            className="cancel-btn"
                            onClick={() => handleCancelSignup(race.id)}
                          >
                            🚫 Cancel
                          </button>
                        ) : (
                          <button 
                            className="signup-btn"
                            onClick={() => handleSignUp(race.id)}
                          >
                            ✅ Going?
                          </button>
                        )}
                      </div>
                    )}
                    
                    {/* Admin Delete Button */}
                    {currentUser && (currentUser.role === 'admin' || currentUser.role === 'administrator') && (
                      <div className="admin-actions">
                        <button 
                          className="delete-btn"
                          onClick={() => handleDeleteRace(race.id)}
                        >
                          🗑️ Delete Race
                        </button>
                      </div>
                    )}
                  </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="races-calendar">
          {Object.entries(groupRacesByMonth()).map(([month, monthRaces]) => (
            <div key={month} className="month-section">
              <h2 className="month-header">{month}</h2>
              <div className="month-races">
                {monthRaces.map(race => (
                  <div key={race.id} className="calendar-race">
                    <div className="calendar-race-date">
                      {new Date(race.date).getDate()}
                    </div>
                    <div className="calendar-race-info">
                      <h4>{race.name}</h4>
                      {race.location && <p>{race.location}</p>}
                      <p className="calendar-countdown">{getDaysUntilRace(race.date)}</p>
                      {currentUser && isMember(currentUser) && (
                        <span className="signup-count">
                          {race.signups ? race.signups.length : 0} signed up
                        </span>
                      )}
                    </div>
                    {currentUser && isMember(currentUser) && (
                      <div className="calendar-race-actions">
                        {isUserSignedUp(race) ? (
                          <button 
                            className="cancel-btn small"
                            onClick={() => handleCancelSignup(race.id)}
                          >
                            Cancel
                          </button>
                        ) : (
                          <button 
                            className="signup-btn small"
                            onClick={() => handleSignUp(race.id)}
                          >
                            Going?
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Race Modal */}
      {showAddRace && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Add New Race</h2>
            <form onSubmit={handleAddRace}>
              <div className="form-group">
                <label htmlFor="raceName">Race Name *</label>
                <input
                  type="text"
                  id="raceName"
                  value={addRaceForm.name}
                  onChange={(e) => setAddRaceForm({...addRaceForm, name: e.target.value})}
                  required
                  placeholder="Enter race name"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="raceDate">Race Date *</label>
                <input
                  type="date"
                  id="raceDate"
                  value={addRaceForm.date}
                  onChange={(e) => setAddRaceForm({...addRaceForm, date: e.target.value})}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="raceLocation">Location</label>
                <input
                  type="text"
                  id="raceLocation"
                  value={addRaceForm.location}
                  onChange={(e) => setAddRaceForm({...addRaceForm, location: e.target.value})}
                  placeholder="Enter race location"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="raceDescription">Description</label>
                <textarea
                  id="raceDescription"
                  value={addRaceForm.description}
                  onChange={(e) => setAddRaceForm({...addRaceForm, description: e.target.value})}
                  placeholder="Enter race description"
                  rows="3"
                />
              </div>
              
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Add Race</button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowAddRace(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Races;
