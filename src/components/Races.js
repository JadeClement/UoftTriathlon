import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { linkifyText, normalizeRaceLink } from '../utils/linkUtils';
import { showSuccess, showError } from './SimpleNotification';
import ConfirmModal from './ConfirmModal';
import './Races.css';

const Races = () => {
  const { currentUser, isMember, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('table'); // 'list' | 'table' | 'calendar'
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddRace, setShowAddRace] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all' or 'going'
  const [addRaceForm, setAddRaceForm] = useState({
    name: '',
    date: '',
    end_date: '',
    location: '',
    description: '',
    link: ''
  });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, raceId: null });
  const [showEditRace, setShowEditRace] = useState(false);
  const [editRaceId, setEditRaceId] = useState(null);
  const [editRaceForm, setEditRaceForm] = useState({
    name: '',
    date: '',
    end_date: '',
    location: '',
    description: '',
    event: '',
    link: '',
    age_group_qualifying: '',
    course_profile: ''
  });

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

  const toDateInputValue = (dateString) => {
    if (!dateString) return '';
    return String(dateString).split('T')[0];
  };

  const openEditRaceModal = (race, e) => {
    if (e) e.stopPropagation();
    setShowAddRace(false);
    setEditRaceId(race.id);
    setEditRaceForm({
      name: race.name || '',
      date: toDateInputValue(race.date),
      end_date: toDateInputValue(race.end_date),
      location: race.location || '',
      description: race.description || '',
      event: race.event || '',
      link: race.link || '',
      age_group_qualifying: race.age_group_qualifying || '',
      course_profile: race.course_profile || ''
    });
    setShowEditRace(true);
  };

  const closeEditRaceModal = () => {
    setShowEditRace(false);
    setEditRaceId(null);
  };

  const submitEditRace = async (e) => {
    e.preventDefault();
    if (!editRaceForm.name || !editRaceForm.date) {
      showError('Race name and date are required');
      return;
    }
    if (editRaceForm.end_date && editRaceForm.end_date < editRaceForm.date) {
      showError('End date cannot be before start date');
      return;
    }
    if (!editRaceId) return;

    try {
      const token = localStorage.getItem('triathlonToken');
      const response = await fetch(`${API_BASE_URL}/races/${editRaceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editRaceForm.name,
          date: editRaceForm.date,
          end_date: editRaceForm.end_date || null,
          location: editRaceForm.location || null,
          description: editRaceForm.description || null,
          event: editRaceForm.event || null,
          link: editRaceForm.link || null,
          age_group_qualifying: editRaceForm.age_group_qualifying || null,
          course_profile: editRaceForm.course_profile || null
        })
      });

      if (response.ok) {
        await loadRaces();
        closeEditRaceModal();
        showSuccess('Race updated successfully!');
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to update race');
      }
    } catch (err) {
      console.error('Error updating race:', err);
      showError('Failed to update race');
    }
  };

  const handleAddRace = async (e) => {
    e.preventDefault();
    
    if (!addRaceForm.name || !addRaceForm.date) {
      showError('Race name and date are required');
      return;
    }
    if (addRaceForm.end_date && addRaceForm.end_date < addRaceForm.date) {
      showError('End date cannot be before start date');
      return;
    }

    try {
      setShowEditRace(false);
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
          end_date: '',
          location: '',
          description: '',
          link: ''
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

  const formatRaceTableDates = (race) => {
    const start = formatDateShort(race.date);
    if (!race.end_date) return start;
    const startKey = String(race.date).split('T')[0];
    const endKey = String(race.end_date).split('T')[0];
    if (!endKey || endKey <= startKey) return start;
    return `${start}–${formatDateShort(race.end_date)}`;
  };

  const formatRaceListDates = (race) => {
    if (!race.end_date) return formatDate(race.date);
    const startKey = String(race.date).split('T')[0];
    const endKey = String(race.end_date).split('T')[0];
    if (!endKey || endKey <= startKey) return formatDate(race.date);
    return `${formatDate(race.date)} – ${formatDate(race.end_date)}`;
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
              onClick={() => {
                closeEditRaceModal();
                setShowAddRace(true);
              }}
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
                    <div className="race-meta">📅 {formatRaceListDates(race)}</div>
                    <div className="race-countdown inline">{getDaysUntilRace(race.date)}</div>
                    {race.link && (
                      <div className="race-meta race-link-row">
                        <a
                          href={normalizeRaceLink(race.link)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="race-external-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          🔗 Link
                        </a>
                      </div>
                    )}
                  </div>
                  {currentUser && isMember(currentUser) && (
                    <div className="race-actions-top">
                      <button
                        type="button"
                        className="edit-btn"
                        title="Edit race"
                        onClick={(e) => openEditRaceModal(race, e)}
                      >
                        ✏️
                      </button>
                      {currentUser && isAdmin(currentUser) && (
                        <button
                          type="button"
                          className="delete-btn"
                          title="Delete race"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRace(race.id);
                          }}
                        >
                          🗑️
                        </button>
                      )}
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
                    <th className="races-table-col-ag">AG qual.</th>
                    <th className="races-table-col-course">Course</th>
                    <th className="races-table-col-loc">Location</th>
                    <th className="races-table-col-link">Link</th>
                    <th className="races-table-col-when">When</th>
                    {currentUser && isMember(currentUser) && (
                      <th className="races-table-col-whos">Who&apos;s going</th>
                    )}
                    {currentUser && isMember(currentUser) && (
                      <>
                        <th className="races-table-col-narrow races-table-col-count">#ppl</th>
                        <th className="races-table-col-narrow">You</th>
                        <th className="races-table-col-action"> </th>
                      </>
                    )}
                    {currentUser && isMember(currentUser) && (
                      <th className="races-table-col-edit"> </th>
                    )}
                    {(currentUser && isAdmin(currentUser)) && (
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
                      <td className="races-table-col-date">{formatRaceTableDates(race)}</td>
                      <td className="races-table-col-name">
                        <span className="races-table-name">{race.name}</span>
                      </td>
                      <td className="races-table-col-event">
                        <span className="races-table-event">{race.event || '—'}</span>
                      </td>
                      <td
                        className="races-table-col-ag"
                        title={race.age_group_qualifying || undefined}
                      >
                        <span className="races-table-muted races-table-clip">
                          {race.age_group_qualifying || '—'}
                        </span>
                      </td>
                      <td
                        className="races-table-col-course"
                        title={race.course_profile || undefined}
                      >
                        <span className="races-table-muted races-table-clip">
                          {race.course_profile || '—'}
                        </span>
                      </td>
                      <td className="races-table-col-loc">
                        <span className="races-table-muted">{race.location || '—'}</span>
                      </td>
                      <td className="races-table-col-link">
                        {race.link ? (
                          <a
                            href={normalizeRaceLink(race.link)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="races-table-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open
                          </a>
                        ) : (
                          <span className="races-table-muted">—</span>
                        )}
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
                      {currentUser && isMember(currentUser) && (
                        <td className="races-table-col-edit">
                          <button
                            type="button"
                            className="edit-btn races-table-icon-btn"
                            title="Edit race"
                            onClick={(e) => openEditRaceModal(race, e)}
                          >
                            ✏️
                          </button>
                        </td>
                      )}
                      {(currentUser && isAdmin(currentUser)) && (
                        <td className="races-table-col-admin">
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
                <label htmlFor="raceEndDate">End date (optional)</label>
                <input
                  type="date"
                  id="raceEndDate"
                  value={addRaceForm.end_date}
                  onChange={(e) => setAddRaceForm({ ...addRaceForm, end_date: e.target.value })}
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

              <div className="form-group">
                <label htmlFor="raceLink">Link</label>
                <input
                  type="text"
                  id="raceLink"
                  value={addRaceForm.link}
                  onChange={(e) => setAddRaceForm({ ...addRaceForm, link: e.target.value })}
                  placeholder="Race website or registration URL"
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

      {showEditRace && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Edit Race</h2>
            <form onSubmit={submitEditRace}>
              <div className="form-group">
                <label htmlFor="editRaceName">Race Name *</label>
                <input
                  type="text"
                  id="editRaceName"
                  value={editRaceForm.name}
                  onChange={(e) => setEditRaceForm({ ...editRaceForm, name: e.target.value })}
                  required
                  placeholder="Enter race name"
                />
              </div>

              <div className="modal-form-section">
                <h3 className="modal-form-section-title">Dates</h3>
                <div className="form-group">
                  <label htmlFor="editRaceDate">Start date *</label>
                  <input
                    type="date"
                    id="editRaceDate"
                    value={editRaceForm.date}
                    onChange={(e) => setEditRaceForm({ ...editRaceForm, date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editRaceEndDate">End date (optional)</label>
                  <p className="modal-form-hint">
                    Leave blank for a single-day race. Use for multi-day events (must be on or after the start date).
                  </p>
                  <input
                    type="date"
                    id="editRaceEndDate"
                    value={editRaceForm.end_date}
                    min={editRaceForm.date || undefined}
                    onChange={(e) => setEditRaceForm({ ...editRaceForm, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="editRaceLocation">Location</label>
                <input
                  type="text"
                  id="editRaceLocation"
                  value={editRaceForm.location}
                  onChange={(e) => setEditRaceForm({ ...editRaceForm, location: e.target.value })}
                  placeholder="Enter race location"
                />
              </div>

              <div className="form-group">
                <label htmlFor="editRaceEvent">Event</label>
                <input
                  type="text"
                  id="editRaceEvent"
                  value={editRaceForm.event}
                  onChange={(e) => setEditRaceForm({ ...editRaceForm, event: e.target.value })}
                  placeholder="e.g. Sprint, Olympic, Ironman"
                />
              </div>

              <div className="form-group">
                <label htmlFor="editRaceDescription">Description</label>
                <textarea
                  id="editRaceDescription"
                  value={editRaceForm.description}
                  onChange={(e) => setEditRaceForm({ ...editRaceForm, description: e.target.value })}
                  placeholder="Enter race description"
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label htmlFor="editRaceLink">Link</label>
                <input
                  type="text"
                  id="editRaceLink"
                  value={editRaceForm.link}
                  onChange={(e) => setEditRaceForm({ ...editRaceForm, link: e.target.value })}
                  placeholder="Race website or registration URL"
                />
              </div>

              <div className="form-group">
                <label htmlFor="editRaceAgeGroup">Age group qualifying</label>
                <input
                  type="text"
                  id="editRaceAgeGroup"
                  value={editRaceForm.age_group_qualifying}
                  onChange={(e) => setEditRaceForm({ ...editRaceForm, age_group_qualifying: e.target.value })}
                  placeholder="Optional"
                />
              </div>

              <div className="form-group">
                <label htmlFor="editRaceCourseProfile">Course profile</label>
                <textarea
                  id="editRaceCourseProfile"
                  value={editRaceForm.course_profile}
                  onChange={(e) => setEditRaceForm({ ...editRaceForm, course_profile: e.target.value })}
                  placeholder="Optional"
                  rows="2"
                />
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">Save</button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeEditRaceModal}
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
