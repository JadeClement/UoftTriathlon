import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { linkifyText } from '../utils/linkUtils';
import { showSuccess, showError } from './SimpleNotification';
import ConfirmModal from './ConfirmModal';
import './Races.css';

const Races = () => {
  const { currentUser, isMember } = useAuth();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'table' | 'calendar'
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddRace, setShowAddRace] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all' or 'going'
  const [addRaceForm, setAddRaceForm] = useState({
    name: '',
    date: '',
    location: '',
    description: ''
  });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, raceId: null });

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

  const cachedUser = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('triathlonUser');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('🧭 Races: failed to parse cached user', e);
      return null;
    }
  }, []);
  const effectiveUser = currentUser || cachedUser;

  useEffect(() => {
    if (effectiveUser && isMember(effectiveUser)) {
      loadRaces();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUser]);

  const loadRaces = async () => {
    try {
      setLoading(true);
      setError(null);
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
        const errMsg = `Failed to load races: ${response.status}`;
        setError(errMsg);
      }
    } catch (err) {
      console.error('Error loading races:', err);
      setError(`Failed to load races: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRace = async (e) => {
    e.preventDefault();
    
    if (!addRaceForm.name || !addRaceForm.date) {
      showError('Race name and date are required');
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
        showError(errorData.error || 'Failed to add race');
      }
    } catch (error) {
      console.error('Error adding race:', error);
      showError('Failed to add race');
    }
  };

  const handleSignUp = async (raceId) => {
    if (!currentUser || !isMember(currentUser)) {
      showError('You must be a member to sign up for races');
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
        showError(errorData.error || 'Failed to sign up for race');
      }
    } catch (error) {
      console.error('Error signing up for race:', error);
      showError('Failed to sign up for race');
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
        showError(errorData.error || 'Failed to cancel signup');
      }
    } catch (error) {
      console.error('❌ Error canceling signup:', error);
      showError('Failed to cancel signup');
    }
  };

  const handleDeleteRace = async (raceId) => {
    setDeleteConfirm({ isOpen: true, raceId });
  };

  const confirmDeleteRace = async () => {
    const { raceId } = deleteConfirm;
    setDeleteConfirm({ isOpen: false, raceId: null });

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
        showSuccess('Race deleted successfully!');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete race');
      }
    } catch (error) {
      console.error('Error deleting race:', error);
      showError(`Error deleting race: ${error.message}`);
    }
  };

  const isUserSignedUp = (race) => {
    if (!currentUser) return false;
    return race.signups && race.signups.some(signup => signup.user_id === currentUser.id);
  };

  const handleRaceClick = (raceId) => {
    navigate(`/race/${raceId}`);
  };

  const handleEditRace = (raceId, e) => {
    if (e) e.stopPropagation();
    navigate(`/race/${raceId}`);
  };

  const formatDate = (dateString) => {
    try {
      const base = String(dateString).split('T')[0];
      const [y, m, d] = base.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC'
      });
    } catch {
      return dateString;
    }
  };

  const getDaysUntilRace = (dateString) => {
    try {
      const base = String(dateString).split('T')[0];
      const [y, m, d] = base.split('-').map(Number);
      const raceDate = new Date(Date.UTC(y, m - 1, d));
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0); // Reset time to start of day in UTC
      raceDate.setUTCHours(0, 0, 0, 0); // Reset time to start of day in UTC
      
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
    } catch {
      return 'Unknown';
    }
  };

  const getMonthName = (dateString) => {
    try {
      const base = String(dateString).split('T')[0];
      const [y, m, d] = base.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    } catch {
      return dateString;
    }
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

  const getRacesSortedByDate = () =>
    [...getFilteredRaces()].sort((a, b) => {
      const da = String(a.date).split('T')[0];
      const db = String(b.date).split('T')[0];
      return da.localeCompare(db);
    });

  const formatDateShort = (dateString) => {
    try {
      const base = String(dateString).split('T')[0];
      const [y, m, d] = base.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
      });
    } catch {
      return dateString;
    }
  };

  const getWhosGoingSummary = (race) => {
    const signups = race.signups || [];
    if (signups.length === 0) {
      return { text: '—', full: 'No one signed up yet' };
    }
    const names = signups.map((s) => s.user_name || 'Member').filter(Boolean);
    const joined = names.join(', ');
    const maxNames = 3;
    if (names.length <= maxNames) {
      return { text: joined, full: joined };
    }
    const extra = names.length - maxNames;
    return {
      text: `${names.slice(0, maxNames).join(', ')} +${extra}`,
      full: joined
    };
  };

  if (loading) {
    return (
      <div className="races-container">
        <div className="loading">Loading races...</div>
      </div>
    );
  }

  if (error) {
    const isOffline = !navigator.onLine || /network error|load failed|failed to fetch|failed to connect/i.test(error);
    if (isOffline) {
      return (
        <div className="races-container">
          <div className="races-content">
            <div style={{
              textAlign: 'center',
              padding: '3rem 2rem',
              maxWidth: '400px',
              margin: '0 auto'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📴</div>
              <h2 style={{ color: '#374151', marginBottom: '0.75rem' }}>You&apos;re Offline</h2>
              <p style={{ color: '#6b7280', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                The Races page needs an internet connection to load. Check your connection and try again when you&apos;re back online.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => { setError(null); loadRaces(); }}
                disabled={!navigator.onLine}
              >
                Try Again
              </button>
              {!navigator.onLine && (
                <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '1rem' }}>
                  Waiting for connection...
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="races-container">
        <div className="races-content">
          <h1>Races</h1>
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#991b1b'
          }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Error loading races</h2>
            <p style={{ marginBottom: '1rem' }}>{error}</p>
            <button className="btn btn-primary" onClick={() => { setError(null); loadRaces(); }}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const noAccessMessage = (
    <div className="races-container">
      <div className="races-content">
        <h1>Races</h1>
        <div className="notice-card" style={{
          background: '#fff8e1',
          border: '1px solid #facc15',
          color: '#92400e',
          padding: '16px',
          borderRadius: '8px',
          lineHeight: 1.6,
          marginTop: '16px'
        }}>
          <p style={{ margin: 0 }}>
            You don't have access to the races yet. Please email <a href="mailto:info@uoft-tri.club">info@uoft-tri.club</a> your membership receipt and we will confirm your registration! You will have to log out and then log back in to see this page.
          </p>
          <p style={{ margin: '12px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
            <strong>Note:</strong> If you were a member on our old website, you'll be automatically approved as a member once you sign up. You will get an email once you get access!
          </p>
        </div>
      </div>
    </div>
  );

  if (!effectiveUser) {
    return noAccessMessage;
  }

  if (!isMember(effectiveUser)) {
    return noAccessMessage;
  }

  return (
    <div className="races-container">
      <div className="races-content">
        <div className="races-header">
          <h1>Races</h1>
          <div className="view-toggle">
          <button
            type="button"
            className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            📋 List
          </button>
          <button
            type="button"
            className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            📊 Table
          </button>
          <button
            type="button"
            className={`toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
            onClick={() => setViewMode('calendar')}
          >
            📅 Calendar
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

      {viewMode === 'list' && (
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
                  <div className="race-main">
                    <h2 className="race-name">{race.name}</h2>
                    {race.location && (
                      <div className="race-meta">📍 {race.location}</div>
                    )}
                    <div className="race-meta">📅 {formatDate(race.date)}</div>
                    <div className="race-countdown inline">{getDaysUntilRace(race.date)}</div>
                  </div>
                  {(currentUser && (currentUser.role === 'exec' || currentUser.role === 'administrator')) && (
                    <div className="race-actions-top">
                      <button 
                        className="edit-btn"
                        onClick={(e) => handleEditRace(race.id, e)}
                      >
                        ✏️
                      </button>
                      <button 
                        className="delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRace(race.id);
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
                <div className="race-details">
                  {race.description && <p><strong>📝 Description:</strong> {linkifyText(race.description)}</p>}
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
                      isUserSignedUp(race) ? (
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
                      )
                    )}
                    
                    {/* Admin actions moved to top right */}
                  </div>
              </div>
            ))
          )}
        </div>
      )}

      {viewMode === 'table' && (
        <div className="races-table-shell">
          {getRacesSortedByDate().length === 0 ? (
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
            <div className="races-table-wrap">
              <table className="races-table">
                <thead>
                  <tr>
                    <th className="races-table-col-date">Date</th>
                    <th className="races-table-col-name">Race</th>
                    <th className="races-table-col-event">Event</th>
                    <th className="races-table-col-loc">Location</th>
                    <th className="races-table-col-when">When</th>
                    {currentUser && isMember(currentUser) && (
                      <th className="races-table-col-whos">Who&apos;s going</th>
                    )}
                    {currentUser && isMember(currentUser) && (
                      <>
                        <th className="races-table-col-narrow">#</th>
                        <th className="races-table-col-narrow">You</th>
                        <th className="races-table-col-action"> </th>
                      </>
                    )}
                    {(currentUser && (currentUser.role === 'exec' || currentUser.role === 'administrator')) && (
                      <th className="races-table-col-admin"> </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {getRacesSortedByDate().map((race) => {
                    const whosGoing = getWhosGoingSummary(race);
                    return (
                    <tr
                      key={race.id}
                      className="races-table-row"
                      onClick={() => handleRaceClick(race.id)}
                    >
                      <td className="races-table-col-date">{formatDateShort(race.date)}</td>
                      <td className="races-table-col-name">
                        <span className="races-table-name">{race.name}</span>
                      </td>
                      <td className="races-table-col-event">
                        <span className="races-table-event">{race.event || '—'}</span>
                      </td>
                      <td className="races-table-col-loc">
                        <span className="races-table-muted">{race.location || '—'}</span>
                      </td>
                      <td className="races-table-col-when">
                        <span className="races-table-badge">{getDaysUntilRace(race.date)}</span>
                      </td>
                      {currentUser && isMember(currentUser) && (
                        <td
                          className="races-table-col-whos"
                          title={whosGoing.full}
                        >
                          <span className="races-table-whos">
                            {whosGoing.text}
                          </span>
                        </td>
                      )}
                      {currentUser && isMember(currentUser) && (
                        <>
                          <td className="races-table-col-narrow races-table-num">
                            {race.signups ? race.signups.length : 0}
                          </td>
                          <td className="races-table-col-narrow">
                            {isUserSignedUp(race) ? (
                              <span className="races-table-yes" title="You're signed up">✓</span>
                            ) : (
                              <span className="races-table-no" title="Not signed up">—</span>
                            )}
                          </td>
                          <td className="races-table-col-action">
                            {isUserSignedUp(race) ? (
                              <button
                                type="button"
                                className="cancel-btn races-table-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelSignup(race.id);
                                }}
                              >
                                Cancel
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="signup-btn races-table-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSignUp(race.id);
                                }}
                              >
                                Going?
                              </button>
                            )}
                          </td>
                        </>
                      )}
                      {(currentUser && (currentUser.role === 'exec' || currentUser.role === 'administrator')) && (
                        <td className="races-table-col-admin">
                          <div className="races-table-admin">
                            <button
                              type="button"
                              className="edit-btn races-table-icon-btn"
                              title="Edit race"
                              onClick={(e) => handleEditRace(race.id, e)}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              className="delete-btn races-table-icon-btn"
                              title="Delete race"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRace(race.id);
                              }}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {viewMode === 'calendar' && (
        <div className="races-calendar">
          {Object.entries(groupRacesByMonth()).map(([month, monthRaces]) => (
            <div key={month} className="month-section">
              <h2 className="month-header">{month}</h2>
              <div className="month-races">
                {monthRaces.map(race => (
                  <div key={race.id} className="calendar-race">
                    <div className="calendar-race-date">
                      {(() => {
                        try {
                          const base = String(race.date).split('T')[0];
                          const [y, m, d] = base.split('-').map(Number);
                          const date = new Date(Date.UTC(y, m - 1, d));
                          return date.getUTCDate();
                        } catch {
                          return race.date;
                        }
                      })()}
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
                      isUserSignedUp(race) ? (
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
                      )
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

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onConfirm={confirmDeleteRace}
        onCancel={() => setDeleteConfirm({ isOpen: false, raceId: null })}
        title="Delete Race"
        message="Are you sure you want to delete this race? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmDanger={true}
      />
      </div>
    </div>
  );
};

export default Races;
