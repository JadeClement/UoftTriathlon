import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showError } from './SimpleNotification';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

const Results = () => {
  const { currentUser, isMember, updateUser } = useAuth();
  const navigate = useNavigate();

  const isIOSNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  const [intervalResults, setIntervalResults] = useState([]);
  const [resultsPublic, setResultsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [workouts, setWorkouts] = useState([]);
  const [intervals, setIntervals] = useState([]);
  const [addForm, setAddForm] = useState({
    workoutId: '',
    intervalId: '',
    time: ''
  });
  const [workoutsLoading, setWorkoutsLoading] = useState(false);
  const [intervalsLoading, setIntervalsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const v = currentUser?.results_public ?? currentUser?.resultsPublic ?? false;
    setResultsPublic(v);
  }, [currentUser]);

  useEffect(() => {
    const load = async () => {
      if (!currentUser?.id) return;
      setLoading(true);
      try {
        const token = localStorage.getItem('triathlonToken');
        const res = await fetch(`${API_BASE}/forum/interval-results/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setIntervalResults(data.intervalResults || []);
        }
      } catch (err) {
        console.error('Error loading interval results:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser]);

  useEffect(() => {
    if (!showAddForm || !currentUser?.id) return;
    const loadWorkouts = async () => {
      setWorkoutsLoading(true);
      try {
        const token = localStorage.getItem('triathlonToken');
        const res = await fetch(`${API_BASE}/forum/workouts-with-intervals`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setWorkouts(data.workouts || []);
        }
      } catch (err) {
        console.error('Error loading workouts:', err);
      } finally {
        setWorkoutsLoading(false);
      }
    };
    loadWorkouts();
  }, [showAddForm, currentUser?.id]);

  useEffect(() => {
    if (!addForm.workoutId) {
      setIntervals([]);
      setAddForm((f) => ({ ...f, intervalId: '', time: '' }));
      return;
    }
    const loadIntervals = async () => {
      setIntervalsLoading(true);
      try {
        const token = localStorage.getItem('triathlonToken');
        const res = await fetch(`${API_BASE}/forum/workouts/${addForm.workoutId}/intervals`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setIntervals(data.intervals || []);
        }
      } catch (err) {
        console.error('Error loading intervals:', err);
      } finally {
        setIntervalsLoading(false);
      }
    };
    loadIntervals();
  }, [addForm.workoutId]);

  const handleSaveAddResult = async () => {
    if (!addForm.workoutId || !addForm.intervalId || !addForm.time?.trim()) {
      showError('Please select a workout, interval, and enter your time');
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem('triathlonToken');
      const res = await fetch(
        `${API_BASE}/forum/workouts/${addForm.workoutId}/interval-results`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            results: [{ interval_id: parseInt(addForm.intervalId, 10), time: addForm.time.trim() }],
          }),
        }
      );
      if (res.ok) {
        showSuccess('Interval result saved!');
        setAddForm({ workoutId: '', intervalId: '', time: '' });
        setShowAddForm(false);
        setIntervals([]);
        const refresh = await fetch(`${API_BASE}/forum/interval-results/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (refresh.ok) {
          const data = await refresh.json();
          setIntervalResults(data.intervalResults || []);
        }
      } else {
        const err = await res.json();
        showError(err.error || 'Failed to save');
      }
    } catch (err) {
      showError('Failed to save interval result');
    } finally {
      setSaving(false);
    }
  };

  // Flatten to table rows: workout date | interval title | interval time | interval description
  const tableRows = React.useMemo(() => {
    return [...intervalResults]
      .sort((a, b) => {
        const da = a.workout_date || '';
        const db = b.workout_date || '';
        if (da !== db) return db.localeCompare(da);
        const ta = a.workout_time || '';
        const tb = b.workout_time || '';
        if (ta !== tb) return tb.localeCompare(ta);
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      });
  }, [intervalResults]);

  return (
    <div className="profile-container">
      <div className="container">
        {!currentUser ? (
          <div>
            <h2>Your interval results</h2>
            <p>You need to be logged in to view your interval results.</p>
          </div>
        ) : !isMember(currentUser) ? (
          <div>
            <h2>Your interval results</h2>
            <p>Results are only available for full members.</p>
          </div>
        ) : !isIOSNative ? (
          <div>
            <h2>Your interval results</h2>
            <p>This page is only available in the iOS app.</p>
          </div>
        ) : (
          <>
            <div
              style={{
                marginTop: '2rem',
                background: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <h2 style={{ margin: 0, color: '#374151' }}>Interval Results</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowAddForm(!showAddForm)}
                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                  >
                    {showAddForm ? 'Cancel' : '+ Add Interval Result'}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={resultsPublic}
                        onChange={async (e) => {
                          const newValue = e.target.checked;
                          setResultsPublic(newValue);
                          try {
                            const token = localStorage.getItem('triathlonToken');
                            const res = await fetch(`${API_BASE}/users/profile`, {
                              method: 'PUT',
                              headers: {
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                name: currentUser.name,
                                email: currentUser.email,
                                phone_number: currentUser.phone_number || currentUser.phoneNumber,
                                bio: currentUser.bio,
                                results_public: newValue,
                              }),
                            });
                            if (res.ok) {
                              updateUser({
                                ...currentUser,
                                results_public: newValue,
                                resultsPublic: newValue,
                              });
                            } else {
                              setResultsPublic(!newValue);
                            }
                          } catch (err) {
                            setResultsPublic(!newValue);
                          }
                        }}
                      />
                      <span className="toggle-slider" />
                    </label>
                    <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      {resultsPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                Add interval results below or from the workout detail page after completing a workout.
              </p>

              {showAddForm && (
                <div
                  style={{
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#374151' }}>
                    Add Interval Result
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '400px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                        Workout
                      </label>
                      <select
                        value={addForm.workoutId}
                        onChange={(e) => setAddForm({ ...addForm, workoutId: e.target.value, intervalId: '', time: '' })}
                        disabled={workoutsLoading}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }}
                      >
                        <option value="">Select a workout...</option>
                        {workouts.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.title}
                            {w.workout_date ? ` (${new Date(w.workout_date).toLocaleDateString()})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                        Interval
                      </label>
                      <select
                        value={addForm.intervalId}
                        onChange={(e) => setAddForm({ ...addForm, intervalId: e.target.value })}
                        disabled={!addForm.workoutId || intervalsLoading}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }}
                      >
                        <option value="">Select an interval...</option>
                        {intervals.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.title || 'Interval'} {inv.description ? `(${inv.description})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
                        Time
                      </label>
                      <input
                        type="text"
                        value={addForm.time}
                        onChange={(e) => setAddForm({ ...addForm, time: e.target.value })}
                        placeholder="e.g., 2:15, 4:32"
                        disabled={!addForm.intervalId}
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.875rem' }}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSaveAddResult}
                      disabled={saving || !addForm.workoutId || !addForm.intervalId || !addForm.time?.trim()}
                      style={{ alignSelf: 'flex-start', fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Loading...</p>
              ) : tableRows.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Workout Date</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Interval Title</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Time</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Interval Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((r) => (
                        <tr
                          key={r.id || `${r.post_id}-${r.interval_id}`}
                          style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                          onClick={() => navigate(`/forum/workouts/${r.post_id}`)}
                        >
                          <td style={{ padding: '0.75rem', color: '#475569' }}>
                            {r.workout_date ? new Date(r.workout_date).toLocaleDateString() : '-'}
                            {r.workout_time ? ` ${String(r.workout_time).slice(0, 5)}` : ''}
                          </td>
                          <td style={{ padding: '0.75rem', color: '#475569' }}>{r.interval_title || '-'}</td>
                          <td style={{ padding: '0.75rem', color: '#475569' }}>{r.time || '-'}</td>
                          <td style={{ padding: '0.75rem', color: '#475569' }}>{r.interval_description || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p
                  style={{
                    color: '#6b7280',
                    textAlign: 'center',
                    padding: '2rem',
                  }}
                >
                  No interval results yet. Complete a workout with intervals and add your times from
                  the workout detail page.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Results;
