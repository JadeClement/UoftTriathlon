import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001/api';

const Results = () => {
  const { currentUser, isMember, updateUser } = useAuth();
  const navigate = useNavigate();

  const isIOSNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  const [intervalResults, setIntervalResults] = useState([]);
  const [resultsPublic, setResultsPublic] = useState(false);
  const [loading, setLoading] = useState(true);

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

  // Group by workout (post_id)
  const byWorkout = React.useMemo(() => {
    const map = {};
    intervalResults.forEach((r) => {
      const key = r.post_id;
      if (!map[key]) {
        map[key] = {
          post_id: key,
          workout_title: r.workout_title,
          workout_date: r.workout_date,
          workout_time: r.workout_time,
          workout_type: r.workout_type,
          intervals: [],
        };
      }
      map[key].intervals.push({
        interval_id: r.interval_id,
        interval_title: r.interval_title,
        interval_description: r.interval_description,
        sort_order: r.sort_order,
        time: r.time,
      });
    });
    return Object.values(map).map((w) => ({
      ...w,
      intervals: w.intervals.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    })).sort((a, b) => {
      const da = a.workout_date || '';
      const db = b.workout_date || '';
      if (da !== db) return db.localeCompare(da);
      return (b.workout_time || '').localeCompare(a.workout_time || '');
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
                }}
              >
                <h2 style={{ margin: 0, color: '#374151' }}>Interval Results</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                Add interval results from the workout detail page after completing a workout.
              </p>

              {loading ? (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>Loading...</p>
              ) : byWorkout.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  {byWorkout.map((workout) => (
                    <div
                      key={workout.post_id}
                      style={{
                        marginBottom: '1.5rem',
                        padding: '1rem',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        cursor: 'pointer',
                      }}
                      onClick={() => navigate(`/forum/workouts/${workout.post_id}`)}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.75rem',
                        }}
                      >
                        <h3 style={{ margin: 0, color: '#374151', fontSize: '1rem' }}>
                          {workout.workout_title}
                        </h3>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          {workout.workout_date
                            ? new Date(workout.workout_date).toLocaleDateString()
                            : '-'}
                          {workout.workout_time ? (
                            <span> • {String(workout.workout_time).slice(0, 5)}</span>
                          ) : null}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.5rem 1.5rem',
                          fontSize: '0.875rem',
                          color: '#475569',
                        }}
                      >
                        {workout.intervals.map((inv) => (
                          <span key={inv.interval_id}>
                            <strong>{inv.interval_title || 'Interval'}:</strong> {inv.time}
                            {inv.interval_description ? ` (${inv.interval_description})` : ''}
                          </span>
                        ))}
                      </div>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                        Tap to view workout & edit results →
                      </div>
                    </div>
                  ))}
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
